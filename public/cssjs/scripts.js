$(function(){
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
		var html = '';
		for(i = 0; i < data.length;i++){
			html += '<li class="list-group-item">'+data[i]+'<span class="request-fight">Fight</span></li>';
		}
		$users.html(html);
	})

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
    minesweeper.init();
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