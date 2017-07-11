<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$cxn = mysql_connect('localhost', 'root', '');
if (!$cxn)
    return 0;
mysql_select_db('minesweeper', $cxn);

if (!post('username'))
    return 1;
if (!post('password'))
    return 2;
return 3;
?>