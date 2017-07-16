
var MineSweeper;


jQuery(function($){
	// 'use strict';
 	var socket = io.connect();
	var $messageForm = $('#messageForm');
	var $message = $("#message");
	var $chat = $('#chat');
	var $userForm = $("#userForm");
	var $messageArea = $("#messageArea");
	var $users = $("#users");
	var $username = $("#username");
	var $loginregister = $(".loginregister");
	var $login = $('.userformclass');
	var $register = $('.userformregisterclass');

	    
    // standard level configurations
    var levels = {
        'beginner': {
            'boardSize': [9, 9],
            'numMines': 10
        },
        'intermediate': {
            'boardSize': [16, 16],
            'numMines': 40
        },
        'expert': {
            'boardSize': [30, 16],
            'numMines': 99
        }
    };

    // "Static Constants"
    var STATE_UNKNOWN = 'unknown',
        STATE_OPEN = 'open',
        STATE_NUMBER = 'number',
        STATE_FLAGGED = 'flagged',
        STATE_EXPLODE = 'explode',
        STATE_QUESTION = 'question';
    var LEFT_MOUSE_BUTTON = 1,
        RIGHT_MOUSE_BUTTON = 3;
    var MAX_X = 30,
        MAX_Y = 30;

    MineSweeper = function () {
        // prevent namespace pollution
        if (!(this instanceof MineSweeper)) {
            throw 'Invalid use of Minesweeper';
        }
        var msObj = this;
        this.options = {};
        this.grid = [];
        this.running = true;
        this.defaults = {
            selector: '#minesweeper',
            boardSize: levels.beginner.boardSize,
            numMines: levels.beginner.numMines,
            pathToCellToucher: 'cssjs/cell_toucher.js'
        };

        this.init = function (options) {
            msObj.options = $.extend({}, msObj.defaults, options || {});
            var msUI = $(msObj.options.selector);
            if (!msUI.length) {
                throw 'MineSweeper element not found';
            }
            if (!window.JSON) {
                throw 'This application requires a JSON parser.';
            }
            // insert progress animation before the grid
            if ($('.ajax-loading').length < 1) {
                msUI.before(
                '<div class="invisible ajax-loading"></div>'
                );
            }
            msObj.initWorkers(msObj.options.pathToCellToucher);
            msObj.clearBoard();
            msObj.redrawBoard();
            msObj.resetDisplays();
            msObj.initHandlers(msUI);
            return msObj;
        };

        /**
         *
         * @param taskType get_adjacent, touch_adjacent, or calc_win
         * @param payload number or object with {x: ?, y: ?}
         */
        this.callWorker = function(taskType, payload) {
            $('.ajax-loading').removeClass('invisible');
            var job = {
                type: taskType, // message type
                grid: msObj.grid
            };
            if (typeof payload === 'number') {
                job.mines = payload;
            } else if (typeof payload === 'object'){
                job.x = payload.x;
                job.y = payload.y;
            }
            msObj.worker.postMessage(JSON.stringify(job));
        };

        this.initWorkers = function (wPath) {
            if (window.Worker) {
                // Create a background web worker to process the grid "painting" with a stack
                msObj.worker = new Worker(wPath);
                msObj.worker.onmessage = function (e) {
                    var data = JSON.parse(e.data);
                    msObj.handleWorkerMessage(data);
                };
            } else {
                alert(
                    'Minesweeper requires Web Worker support. ' +
                    'See https://browser-update.org/update.html'
                );
            }
        };

        this.initHandlers = function (msUI) {

            msUI.on('contextmenu', '.cell', function (ev) {
                ev.preventDefault();
            });

            msUI.on('mousedown', function (ev) {
                if (ev.which === RIGHT_MOUSE_BUTTON) {
                    clearTimeout(msObj.RIGHT_BUTTON_TIMEOUT);
                    msObj.RIGHT_MOUSE_DOWN = true;
                } else if (ev.which === LEFT_MOUSE_BUTTON) {
                    clearTimeout(msObj.LEFT_BUTTON_TIMEOUT);
                    msObj.LEFT_MOUSE_DOWN = true;
                }
            });

            msUI.on('mouseup', function (ev) {
                if (ev.which === RIGHT_MOUSE_BUTTON) {
                    msObj.RIGHT_BUTTON_TIMEOUT = setTimeout(function () {
                        msObj.RIGHT_MOUSE_DOWN = false;
                    }, 50);
                } else if (ev.which === LEFT_MOUSE_BUTTON) {
                    msObj.LEFT_BUTTON_TIMEOUT = setTimeout(function () {
                        msObj.LEFT_MOUSE_DOWN = false;
                    }, 50);
                }
            });

            msUI.on('mousedown','.cell', function (ev) {
                var targ = $(ev.target);
                if ((ev.which === LEFT_MOUSE_BUTTON && msObj.RIGHT_MOUSE_DOWN) ||
                    (ev.which === RIGHT_MOUSE_BUTTON && msObj.LEFT_MOUSE_DOWN)
                ) {
                    var x = targ.attr('data-x') - 1;
                    var ud = targ.parent().prev();
                    var i;

                    for(i = x; i < x + 3; i++) {
                        ud.children('.unknown.[data-x=' + i + ']').addClass('test');
                    }
                    targ.prev('.unknown').addClass('test');
                    targ.next('.unknown').addClass('test');
                    ud = targ.parent().next();
                    for(i = x; i < x + 3; i++) {
                        ud.children('.unknown.[data-x=' + i + ']').addClass('test');
                    }
                }
            });

            msUI.on('mouseup','.cell', function (ev) {
                var targ = $(ev.target);
                if (ev.which === LEFT_MOUSE_BUTTON) {
                    if (ev.shiftKey || ev.ctrlKey) {
                        msObj.MODIFIER_KEY_DOWN = true;
                        setTimeout(function () {
                            msObj.MODIFIER_KEY_DOWN = false;
                        }, 50);
                        msObj.handleRightClick(targ);
                    } else {
                        msObj.handleLeftClick(targ);
                    }
                } else if (ev.which === RIGHT_MOUSE_BUTTON) {
                    msObj.handleRightClick(targ);
                }
            });

            $('.new-game').on('click', function (ev) {
                ev.preventDefault();
                msObj.stopTimer();
                msObj.timer = '';
                msObj.running = true;
                msObj.setBoardOptions();
                msObj.clearBoard();
                msObj.redrawBoard();
                msObj.resetDisplays();
            });

            $('#level').on('change', function () {
                var input = $('.game_settings input');
                if ($('#level option:selected').val() === 'custom') {
                    input.prop('disabled', false);
                } else {
                    input.prop('disabled', true);
                }
                $('.new-game').trigger('click');
            });

            $('#best_times').on('click', function () {
                var beginnerTime = localStorage.getItem('best_time_beginner') || 'None';
                var intermediateTime = localStorage.getItem('best_time_intermediate') || 'None';
                var expertTime = localStorage.getItem('best_time_expert') || 'None';
                var beginnerName = localStorage.getItem('beginner_record_holder') || 'None';
                var intermediateName = localStorage.getItem('intermediate_record_holder') || 'None';
                var expertName = localStorage.getItem('expert_record_holder') || 'None';
                alert('Best times:\nBeginner:\t' + beginnerName + '\t' + beginnerTime + '\n' +
                    'Intermediate:\t' + intermediateName + '\t' + intermediateTime + '\n' +
                    'Expert:\t' + expertName + '\t' + expertTime);
            });

        };

        /**
         * @return void
         * @param cell jQuery representation of cell
         */
        this.handleRightClick = function (cell) {
            if (!(cell instanceof jQuery)) {
                throw 'Parameter must be jQuery instance';
            }
            if (!msObj.running) {
                return;
            }
            var obj = msObj.getCellObj(cell);

            if (obj.state === STATE_NUMBER) {
                // auto clear neighbor cells
                if (msObj.LEFT_MOUSE_DOWN || msObj.MODIFIER_KEY_DOWN) {
                    msObj.callWorker('get_adjacent', obj);
                }
                return;
            }

            if (obj.state === STATE_NUMBER) {
                return;
            }
            if (obj.state === STATE_QUESTION) {
                obj.state = STATE_UNKNOWN;
            } else {
                var flagDisplay = $('#mine_flag_display'),
                    curr = parseInt(flagDisplay.val(), 10);
                if (obj.state === STATE_UNKNOWN) {
                    obj.state = STATE_FLAGGED;
                    flagDisplay.val(curr - 1);
                } else if (obj.state === STATE_FLAGGED) {
                    obj.state = STATE_QUESTION;
                    flagDisplay.val(curr + 1);
                }
            }
            msObj.drawCell(cell);
        };

        /**
         * @return void
         * @param cell jQuery representation of cell
         */////////////////////////////////////////
        this.handleLeftClick = function (cell) {
            // cell = jQuery object
            // obj = memory state
            if (!(cell instanceof jQuery)) {
                throw 'Parameter must be jQuery instance';
            }
            if (!msObj.running) {
                return;
            }
            if (!msObj.timer) {
                msObj.startTimer();
            }

            var obj = msObj.getCellObj(cell);
            if (obj.state === STATE_OPEN || obj.state === STATE_FLAGGED) {
                // ignore clicks on these
                return;
            }
            if (obj.state === STATE_NUMBER) {
                // auto clear neighbor cells
                if (msObj.RIGHT_MOUSE_DOWN) {
                    msObj.callWorker('get_adjacent',obj);
                }
                return;
            }

            if (obj.mine) {
                // game over
                msObj.gameOver(cell);
                return;
            }

            if (msObj.worker) {
                // Asynchronously
                msObj.callWorker('touch_adjacent',obj);
            } else {
                // Synchronously
                if (!window.touchAdjacent) {
                    throw ('Could not load ' + msObj.options.pathToCellToucher);
                }
                msObj.grid = window.touchAdjacent(obj, msObj.grid);
                // redraw board from memory representation
                msObj.redrawBoard();
            }
        };

        this.handleWorkerMessage = function (data) {
            if (data.type === 'touch_adjacent' || data.type === 'get_adjacent') {
                msObj.grid = data.grid;
                msObj.redrawBoard();
            } else if (data.type === 'calc_win') {
                if (data.win) {
                    msObj.winGame();
                }
            } else if (data.type === 'explode') {
                var cell = msObj.getJqueryObject(data.cell.x, data.cell.y);
                msObj.gameOver(cell);
            } else if (data.type === 'log') {
                if (console && console.log) {
                    console.log(data.obj);
                }
            }
            $('.ajax-loading').addClass('invisible');
        };

        // return memory representation for jQuery instance
        this.getCellObj = function (domObj) {
            var gridobj,
                x,
                y;
            try {
                x = parseInt(domObj.attr('data-x'), 10);
                y = parseInt(domObj.attr('data-y'), 10);
                gridobj = msObj.grid[y][x];
            } catch (e) {
                console.warn('Could not find memory representation for:');
                console.log(domObj);
                throw 'Stopped.';
            }

            return gridobj;
        };

        this.getJqueryObject = function (x, y) {
            return msObj.board.find('.cell[data-coord="' + [x, y].join(',') + '"]');
        };

        this.getRandomMineArray = function () {
            var width = msObj.options.boardSize[0],
                height = msObj.options.boardSize[1],
            // Total Mines is a percentage of the total number of cells
                totalMines = msObj.options.numMines,
                array = [],
                x,
                max,
                infiniteLoop = 0;

            // Put all mines in the beginning
            for (x = 0, max = width * height; x < max; x++) {
                if (x < totalMines) {
                    array[x] = 1;
                } else {
                    array[x] = 0;
                }
            }

            // shuffle array so it's like pulling out of a 'hat'
            // credit: http://sedition.com/perl/javascript-fy.html
            function fisherYates (myArray) {
                var i = myArray.length, j, tempi, tempj;
                if (i === 0) {
                    return;
                }
                while (--i) {
                    j = Math.floor(Math.random() * (i + 1));
                    tempi = myArray[i];
                    tempj = myArray[j];
                    myArray[i] = tempj;
                    myArray[j] = tempi;
                }
            }

            do {
                fisherYates(array);
                infiniteLoop += 1;
                if (infiniteLoop > 20) {
                    break;
                }
            } while(array[0] === 1);

            return array;
        };

        // set the board size and mine density
        this.setBoardOptions = function () {
            var level = $('#level').val();

            if (level === 'custom') {
                var dimX = parseInt($('#dim_x').val(), 10);
                var dimY = parseInt($('#dim_y').val(), 10);
                var numMines = parseInt($('#numMines').val(), 10);

                // rationalise options JIC
                if (isNaN(dimX) || (dimX === 0)) {
                    dimX = 1;
                } else if (dimX > MAX_X) {
                    dimX = MAX_X;
                }
                if (isNaN(dimY) || (dimY === 0)) {
                    dimY = 1;
                } else if (dimY > MAX_Y) {
                    dimY = MAX_Y;
                }
                if (isNaN(numMines) || (numMines === 0)) {
                    numMines = 1;
                } else if (numMines >= (dimX * dimY)) {
                    numMines = (dimX * dimY) - 1;
                }
                // refresh display with updated values
                $('#dim_x').val(dimX);
                $('#dim_y').val(dimY);
                $('#num_mines').val(numMines);

                msObj.options.boardSize = [dimX, dimY];
                msObj.options.numMines = numMines;

            } else {
                msObj.options.boardSize = levels[level].boardSize;
                msObj.options.numMines = levels[level].numMines;
            }

        };

        this.startTimer = function () {
            var timerElement = $('#timer');
            timerElement.val(0);
            console.log('starting timer');
            msObj.timer = window.setInterval(function () {
                var curr = parseInt(timerElement.val(), 10);
                timerElement.val(curr + 1);
            }, 1000);
        };

        this.stopTimer = function () {
            if (msObj.timer) {
                window.clearInterval(msObj.timer);
            }
        };

        this.resetDisplays = function () {

            var level = $('#level option:selected').val();
            var numMines;

            if (level === 'custom') {
                numMines = $('#numMines').val();
            } else {
                numMines = levels[level].numMines;
            }

            $('#mine_flag_display').val(numMines);
            $('#timer').val(0);
        };

        // clear & initialize the internal cell memory grid
        this.clearBoard = function () {
            var width = msObj.options.boardSize[0],
                height = msObj.options.boardSize[1],
                x,
                y,
                z = 0,
                mineHat = msObj.getRandomMineArray();

            msObj.grid = [];
            for (y = 0; y < height; y++) {
                msObj.grid[y] = [];
                for (x = 0; x < width; x++) {
                    msObj.grid[y][x] = {
                        'state': STATE_UNKNOWN,
                        'number': 0,
                        'mine': mineHat[z++],
                        'x': x,
                        'y': y
                    };
                }
            }

            // Insert the board cells in DOM
            if (!msObj.board) {
                $(msObj.options.selector)
                    .html('')
                    .append(msObj.getTemplate('settings'))
                    .append(msObj.getTemplate('actions'))
                    .append(msObj.getTemplate('status'))
                    .append('<div class="board-wrap"></div>');
                msObj.board = $('.board-wrap');
                msObj.board.attr('unselectable', 'on')
                    .css('UserSelect', 'none')
                    .css('MozUserSelect', 'none');
            } else {
                msObj.board.html('');
            }
            for (y = 0; y < height; y++) {
                var row = $('<ul class="row" data-index=' + y + '></ul>');
                for (x = 0; x < width; x++) {
                    var cell;
                    row.append(
                        '<li class="cell" data-coord="' + [x, y].join(',') + '" data-x=' + x +
                        ' data-y=' + y + '>x</li>'
                    );
                    cell = row.find('.cell:last');
                    msObj.drawCell(cell);
                }
                msObj.board.append(row);
            }


        };

        this.redrawBoard = function () {
            msObj.board.find('li.cell').each(function (ind, cell) {
                msObj.drawCell($(cell));
            });
            var data ={
                minefield: msObj.board.prop('outerHTML'),
                opponent: opponent
            }
            socket.emit('mine defuse', msObj.board.prop('outerHTML'), function(data){
            	if(data == true){
            		// alert('data used');
            	}
            });
            if (msObj.worker) {
                msObj.callWorker('calc_win',msObj.options.numMines);
            } else {
                if (!window.touchAdjacent) {
                    throw ('Could not load ' + msObj.options.pathToCellToucher);
                }

                var win = window.minesweeperCalculateWin(msObj.grid);
                if (win) {
                    msObj.winGame();
                }
            }
        };


        this.drawCell = function (x, y) {
            var cell = null,
                gridobj;
            if (x instanceof jQuery) {
                cell = x;
                x = parseInt(cell.attr('data-x'), 10);
                y = parseInt(cell.attr('data-y'), 10);
            } else if (typeof x === 'number' && typeof y === 'number') {
                cell = msObj.getJqueryObject(x, y);
            }

            cell.removeClass().addClass('cell');

            try {
                gridobj = msObj.grid[y][x];
            } catch (e) {
                console.warn('Invalid grid coord: x,y = ' + [x, y].join(','));
                return;
            }
            cell.html('');
            cell.attr('data-number', '');
            switch (gridobj.state) {
                case STATE_FLAGGED:
                    cell.addClass('ui-icon ui-icon-flag');
                    cell.addClass(gridobj.state);
                    break;
                case STATE_QUESTION:
                    cell.addClass('ui-icon ui-icon-help');
                    /* falls through */
                case STATE_UNKNOWN:
                case STATE_OPEN:
                case STATE_EXPLODE:
                    cell.addClass(gridobj.state);
                    break;
                case STATE_NUMBER:
                    cell.addClass('number');
                    cell.html(gridobj.number);
                    cell.attr('data-number', gridobj.number);
                    break;
                default:
                    throw 'Invalid gridobj state: ' + gridobj.state;
            }

        };

        /**
         * @param cellParam
         * @return void
         */
        this.gameOver = function (cellParam) {

            msObj.stopTimer();

            var width = msObj.options.boardSize[0],
                height = msObj.options.boardSize[1],
                x,
                y;

            if (cellParam) {
                cellParam.removeClass();
                cellParam.addClass('cell ' + STATE_EXPLODE);
            }
            for (y = 0; y < height; y++) {
                for (x = 0; x < width; x++) {
                    var obj = msObj.grid[y][x],
                        cell = msObj.getJqueryObject(x,y);
                    if (obj.mine) {
                        cell.removeClass('ui-icon-help')
                            .addClass('ui-icon ui-icon-close blown');
                    } else {
                        cell.addClass('unblown');
                    }
                }
            }
            msObj.running = false;
        };

        this.winGame = function () {
            msObj.stopTimer();
            msObj.running = false;
            var time = $('#timer').val();
            alert('You win!\nYour time: ' + time);
            msObj.checkBestTime(time);
        };

        this.checkBestTime = function (time) {
            var level = $('#level').val();
            if (level !== 'custom') {
                var bestTime = localStorage.getItem('best_time_' + level);

                if (!bestTime || parseInt(time, 10) < parseInt(bestTime, 10)) {
                    var displayName = localStorage.getItem(level + '_record_holder');
                    if (!displayName) {
                        displayName = 'Your name';
                    }
                    var name = window.prompt(
                        'Congrats! You beat the best ' + level + ' time!', displayName
                    );

                    localStorage.setItem('best_time_' + level, time);
                    localStorage.setItem(level + '_record_holder', name);
                }
            }
        };

        this.getTemplate = function (template) {
            var templates = {
                'settings':
                    '<div class="game_settings"><select id="level"><option value="beginner">Beginner</option>' +
                    '<option value="intermediate">Intermediate</option><option value="expert">Expert</option>' +
                    '<option value="custom">Custom</option></select>' +
                    '<input type="text" id="dim_x" placeholder="x" size="5" disabled value="20" />' +
                    '<input type="text" id="dim_y" placeholder="y" size="5" disabled value="20" />' +
                    '<input type="text" id="numMines" placeholder="mines" size="5" disabled />' +
                    '</div>',
                'actions':
                    '<div class="game_actions"><button class="new-game">New Game</button>' +
                    '<button id="bestTimes">Best times</button></div>',
                'status':
                    '<div class="game_status"><label>Time:</label>' +
                    '<input type="text" id="timer" size="6" value="0" readonly />' +
                    '<label>Mines:</label>' +
                    '<input type="text" id="mine_flag_display" size="6" value="10" disabled />'
            };

            return templates[template];
        };

    };


	//Login registration
	$('.go-login').click(function(){
		$login.show();
		$loginregister.hide();
	});
	$('.go-register').click(function(){
		$register.show();
		$loginregister.hide();
	});
	$('.go-back-login').click(function(){
		$login.hide();
		$register.hide();
		$loginregister.show();
	});
	$loginregister.show();
	// message sending chat
	function chatUnlock () {
	    chatLock = false;
	}
    chatLock = false;
	$messageForm.submit(function(e){
		e.preventDefault();
		if(!chatLock){
			chatLock = true;
			 setTimeout(chatUnlock, 2000);
			if($message.val().length < 1){
					//just nothing, was warning to input something before, but I found it annoying
			}else{
				// private message
				// needs to add @Mentions later on using same .search()
				if($message.val().search(/@/i) == 0){
					var pmReciver = $message.val().substr($message.val().search(/@/i)+1, $message.val().indexOf(' ')).replace(/ /g,'');
					if(pmReciver.length == 0){
						$chat.append('<div class="sent-message" style="color: red;">1)PM user not defined 2) @ symbol should be used at start of sentence 3) White spaces are not allowed between "@" and username 4) Message can&apos;t be empty</div>');
					}
					else{
						var message = {
							message: $message.val(),
							pm: 1,
							pmReciver: pmReciver
						}
						socket.emit('send message', message, function(data){
							if(!data){
								$chat.append('<div class="sent-message" style="color: red;">User not online</div>');
							}
						});
						$message.val('');
					}
				}
				// regular message
				else{
					var message = {
						message: $message.val(),
						pm: 0
					}
					socket.emit('send message', message);
					$message.val('');
				}
				
			}
		}else{
			$chat.append('<div class="sent-message" style="color: red;">Don&apos;t Spam</div>');
		}		
	});
	//register
	$(".register-button").click(function(e){
		e.preventDefault();
		$('.forRemove').remove();
		var $username = $("#register-username");
		var $password = $("#register-password");
		// cheking passowrd and username for ijnections and  for safety

		if($username.val() == undefined || $username.val() == '' || $password.val() == undefined || $password.val() == ''){
			$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username and password cannot be epmty');
		}
		else if($username.val().length < 4 || $password.val().length < 4){
			$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username and password must contain atlest 4 letters');
			return;
		}
		else if($username.val().length > 16 ){
			$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username must not be longer than 16 letters');
			return;
		}
		else if(!/^([A-Za-z0-9]{5,})$/.test($username.val()) || !/^([A-Za-z0-9]{5,})$/.test($password.val())){
			$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username and password must not contain illegal symbols');
			return;
		}
		else if(!/^(?=.*\d)([a-z0-9]{5,})$/.test($password.val())){
			$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">password should contain atleast one number</p>');
			return;
		}
		else{
			socket.emit('user register', { username: $username.val(), password: $password.val() }, function(data){
				console.log(data);
				if(data==1){
					$("#register-username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">Username taken</p>');
				}
				else{
					$.cookie('userId', data.userId, { expires: 7, path: '/' });
					$.cookie('username', data.username, { expires: 7, path: '/' });
					$.cookie('rank', data.rank, { expires: 7, path: '/' });
					$.cookie('points', data.points, { expires: 7, path: '/' });
					socket.emit('new user', data.username, function(data){
						if(data){
							$userForm.hide();
							$messageArea.show();
						}
					});
					$username.val('');
				}
			})	
		}
		
	});
	//login
	$(".login-button").click(function(e){
		e.preventDefault();
		$('.forRemove').remove();
		var $username = $("#username");
		var $password = $("#password");
		if($username.val() == undefined || $username.val() == '' || $password.val() == undefined || $password.val() == ''){
			$("#username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username and password cannot be epmty');
		}
		if(!/^([A-Za-z0-9]{5,})$/.test($username.val()) || !/^([A-Za-z0-9]{5,})$/.test($password.val())){
			$("#username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">username and password must not contain illegal symbols');
			return;
		}
		socket.emit('user login', { username: $username.val(), password: $password.val() }, function(data){
			$('.forRemove').remove();
			if(data == 2 || data == 0){
				$("#username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">Invalid Password or username');
			}else if(data == 3){
				$("#username").before('<p class="forRemove" style="width: 100%; text-align: middle; color: red;">User already logged in');
			}else{
                me = data;
				$.cookie('userId', data.userId, { expires: 7, path: '/' });
				$.cookie('username', data.username, { expires: 7, path: '/' });
				$.cookie('rank', data.rank, { expires: 7, path: '/' });
				$.cookie('points', data.points, { expires: 7, path: '/' });
				socket.emit('new user', data.username, function(data){
					if(data){
						$userForm.hide();
						$messageArea.show();
						$chat.append('<div class="system-message"><strong>System:&nbsp;</strong>Welcome to Minesweeper IO, here you can blablabla+ link to rules</div>');
						$(chat).scrollTop($(chat)[0].scrollHeight);
					}
				});
			}	
		});
	});	
	/// messaging
	socket.on('new message', function(data){
		if(data.isPm == 1){
			$chat.append('<div class="sent-pm-message"><strong>'+data.user+':&nbsp;</strong>'+data.msg+'</div>');
			$(chat).scrollTop($(chat)[0].scrollHeight);
		}else if(data.isPm == 3){
			$chat.append('<div class="system-message"><strong>'+data.user+':&nbsp;</strong>'+data.msg+'</div>');
			$(chat).scrollTop($(chat)[0].scrollHeight);
		}else{
			$chat.append('<div class="sent-message"><strong>'+data.user+':&nbsp;</strong>'+data.msg+'</div>');
			$(chat).scrollTop($(chat)[0].scrollHeight);
		}		
	});
	socket.on('get users', function(data){
        console.log(data);
		var html = '';
		for(i = 0; i < data.length;i++){
			html += '<li class="list-group-item">'+data[i]+(data[i] == me.username? '</li>':'<span class="'+(me.gamestatus == 2 ?'already-ingame':'request-fight')+'" data-name="'+data[i]+'">Fight</span></li>');
		}
		$users.html(html);
	})
    $(document).on("click", ".request-fight", function(){
        console.log(1);
        var data = {
            opponentName: $(this).data("name"),
            myInfo: me,
            isRequest: true,
            isResponse: false,
            isAccept: false
        }
        socket.emit("challange player", data);
    });
    socket.on('update opponent mines', function(data){
        $("#minesweeper2").html(data);
    })
    socket.on("new challange", function(data){
        $(document).off("click", ".accept-challange");
        $(document).off("click", ".decline-challange");
        $(".sweeper").prepend("<div class='new-challange'>"+data.username+" <span style='color: green;'>Rank "+data.rank+"</span> Wishes to have a match with you"
                +"<input type='button' class='accept-challange last-added' data-rank='"+data.rank+"' data-opponentname='"+data.username+"' value='Accept' />"
                +"<input type='button' class='decline-challange last-added' data-rank='"+data.rank+"' data-opponentname='"+data.username+"' value='Decline' />"
            +"</div>");
         $(document).on("click", ".accept-challange", function(){
            console.log(2);
            var data = {
                opponentName: $(this).data("opponentname"),
                opponentRank: $(this).data("rank"),
                myInfo: me,
                isRequest: false,
                isResponse: true,
                isAccept: true
            }
            socket.emit("challange player", data);
         });
         $(document).on("click", ".decline-challange", function(){
            console.log(3);
            var data = {
                opponentName: $(this).data("opponentname"),
                myInfo: me,
                isRequest: false,
                isResponse: true,
                isAccept: false
            }
            socket.emit("challange player", data);
            $(this).parent().slideUp(250, function(){
                $(this).remove();
            });
         });
    });
    function countDown(seconds) {
        if(seconds < 4){
            $(".vs-counter").html(seconds);
            if(seconds == 1){
                $(".vs-counter").css('font-size', 24);
                $(".vs-counter").css('color', 'red');
                $(".vs-counter").animate({
                    "font-size": "32"
                }, 400, function() {
                    $(".vs-counter").animate({
                        "font-size": "24"
                    }, 400);
                });
            }
            if(seconds == 2){
                $(".vs-counter").css('font-size', 36);
                $(".vs-counter").css('color', 'yellow');
                $(".vs-counter").animate({
                    "font-size": "44"
                }, 400, function() {
                    $(".vs-counter").animate({
                        "font-size": "36"
                    }, 400);
                });
            }
            if(seconds == 3){
                $(".vs-counter").css('font-size', 48);
                $(".vs-counter").css('color', 'green');
                $(".vs-counter").animate({
                    "font-size": "58"
                }, 400, function() {
                    $(".sweeper").fadeOut(400,function(){
                        $(this).remove();
                    });
                });
            }
            seconds++;
            setTimeout(function(){
                countDown(seconds);
            }, 1000);
        }else{
            
        }
    }
    socket.on("start game", function(data){
        var seconds = 1;
        me.gamestatus = 2;
        opponent = data;
        $(".request-fight").click(false);
        $(".request-fight").css("background-color", "lightgray");
        $(".request-fight").css("cursor", "default");
         $(".new-challange").slideUp(250, function(){
            $(this).remove();
         });
         $(".sweeper").prepend("<div class='countdown'>"
                                    +"<div class='my-side'>"
                                        +"<div class='my-name'>"+me.username+"</div><div class='my-rank'> Rank: "+me.rank+"</div>"
                                    +"</div>"
                                    +"<div class='vs-clock'>"
                                        +"<div class='vs-vs'>VS</div>"
                                         +"<div class='vs-counter'>1</div>"
                                    +"</div>"
                                    +"<div class='opponent-side'>"
                                        +"<div class='opponent-name'>"+data.opponentName+"</div><div class='opponentRank-rank'> Rank: "+data.opponentRank+"</div>"
                                    +"</div>"
                                +"</div>");
        $chat.append('<div class="game-message"><strong>Game:&nbsp;</strong>'+data.opponentName+' is fighting you now</div>');
        $(chat).scrollTop($(chat)[0].scrollHeight);
        countDown(seconds);
    });
    socket.on("challange denied", function(data){
        $chat.append('<div class="game-message"><strong>Game:&nbsp;</strong>'+data+' Declined invite</div>');
        $(chat).scrollTop($(chat)[0].scrollHeight);
    });
    socket.on("user not online", function(data){
        $chat.append('<div class="game-message"><strong>Game:&nbsp;</strong>'+data+' offline</div>');
        $(chat).scrollTop($(chat)[0].scrollHeight);
        $(".new-challange").slideUp(250, function(){
            $(this).remove();
        });
    });
    socket.on("user already ingame", function(data){
        $chat.append('<div class="game-message"><strong>Game:&nbsp;</strong>'+data+' Already ingame</div>');
        $(chat).scrollTop($(chat)[0].scrollHeight);
    });
});
$(document).ready(function () {
    //CHANGE CHAT SIZE ON DRAG EVENT
    var oldYPos = 0;
	var isDragging = false;
	minesweeper = new MineSweeper();
	$(".start-game").click(function() {
		$("#minesweeper").show();
		minesweeper.init();
	});
	$(document).mousemove(function(event) {	
		if (isDragging){
		var difference = event.pageY - oldYPos;
			if(parseInt($("#chat").css("height")) > 40){
				$("#chat").css("height", '-='+difference);
				$(".sweeper").css("height", '+='+difference);
				$("#minesweeper").css("height", '+='+difference);
				$('#minesweeper').css('width', '+='+difference);
				if($('#minesweeper').width() > 180){
					if(parseInt($(".cell.number").css("padding-top")) == 0){
						$('.cell.number').css('padding-top', '+='+2);
					}
				}
				else if(parseInt($(".cell.number").css("padding-top")) == 2){
					$('.cell.number').css('padding-top', '-='+2);
				}
			}
			else if(difference < 0){
				$("#chat").css("height", '-='+difference);
				$(".sweeper").css("height", '+='+difference);
				$("#minesweeper").css("height", '+='+difference);
				$('#minesweeper').css('width', '+='+difference);
				if($('#minesweeper').width() > 180){
					if(parseInt($(".cell.number").css("padding-top")) == 0){
						$('.cell.number').css('padding-top', '+='+2);
					}
				}
				else if(parseInt($(".cell.number").css("padding-top")) == 2){
					$('.cell.number').css('padding-top', '-='+2);
				}
				standStillYPos = oldYPos;
			}
		}
		if(parseInt($("#chat").css("height")) > 40){
			oldYPos = event.pageY;
		}
	});

	$('.scale-chat').mousedown(function() {
		isDragging = true;
		$(this).addClass("mouseDown");
		$(document).mouseup(function() {
			isDragging = false;
			$(this).removeClass("mouseDown");
		})
	})
});
