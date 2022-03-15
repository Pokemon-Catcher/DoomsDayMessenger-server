var socket = io();
var input = document.getElementById('input');
var text = document.getElementById('text');

input.addEventListener('submit', function(e) {
  e.preventDefault();
  if (text.value) {
    socket.emit('send', {text.value});
    text.value = '';
  }
});