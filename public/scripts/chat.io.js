(function($){
  // Global parameters...
  var NICK_MAX_LENGTH = 15,
    ROOM_MAX_LENGTH = 10,
    lockShakeAnimation = false,
    login = false,
    socket = null,
    clientId = null,
    nickname = null,
    currentChannel = null,
    serverAddress = "http://minet.sserhuangdong.com/", // change this to your own website!
    serverDisplayName = 'MIRO',
    serverDisplayColor = '#1c5380',
    tmplt = {
      channel: [
        '<li data-channelId="${channel}" data-userName="${username}">',
        '<span class="icon"></span> ${username}',
        '</li>'
      ].join(""),
      client: [
        '<li data-clientId="${clientId}" data-nickname="${nickname}"class="cf">',
        '<div class="fl clientName"><span class="icon"></span> ${nickname}</div>',
        '<div class="fr composing"></div>',
        '</li>'
      ].join(""),
      message: [
        '<li class="cf">',
        '<div class="fl sender">${sender}: </div><div class="fl text">${text}</div><div class="fr time">${time}</div>',
        '</li>'
      ].join("")
    };

  // bind DOM elements like button clicks and keydown
  function bindDOMEvents() {
    $('.chat-input input').on('keydown', function(e) {
      var key = e.which || e.keyCode;
      if (key == 13) {
        handleMessage();
      }
    });
    $('.chat-submit button').on('click', function() {
      handleMessage();
    });
    $('#nickname-popup .input input').on('keydown', function(e) {
      var key = e.which || e.keyCode;
      if (key == 13) {
        handleNickname();
      }
    });
    $('#nickname-popup .begin').on('click', function() {
      handleNickname();
    });
    $('.big-button-green.start').on('click', function() {
      $('#nickname-popup .input input').val('');
      Avgrund.show('#nickname-popup');
      window.setTimeout(function() {
	$('#nickname-popup .input input').focus();
      },100);
    });
    $('.chat-channels ul').on('scroll', function() {
      $('.chat-channels ul li.selected').css('top', $(this).scrollTop());
    });
    $('.chat-messages').on('scroll', function() {
      var self = this;
      window.setTimeout(function() {
	if ($(self).scrollTop() + $(self).height() < $(self).find('ul').height()) {
	  $(self).addClass('scroll');
	} else {
	  $(self).removeClass('scroll');
	}
      }, 50);
    });
    $('.chat-channels ul li').live('click', function() {
      var channel = $(this).attr('data-channelId');
      var userName = $(this).attr('data-userName');
      if (channel != currentChannel) {
        socket.emit('channelChange', { channel: currentChannel });
        socket.emit('subscribe', { username: userName, channel: channel });
      }
    });
    $('.chat-clients ul li').live('click', function() {
      var userName = $(this).attr('data-nickname');
      if (userName == nickname) {
        return;
      }
      var channelName = (userName > nickname ?
                      nickname + "+" + userName : userName + "+" + nickname);
      socket.emit('p2p', { from: nickname, to: userName, channel: channelName});
    });
  }

  // bind socket.io event handlers
  // this events fired in the server
  function bindSocketEvents() {
    socket.on('connect', function() {
      socket.emit('connect', { nickname: nickname });
    });
    
    socket.on('ready', function(data) {
      $('.chat-shadow').animate({ 'opacity': 0 }, 200, function() {
	$(this).hide();
	$('.chat input').focus();
      });
      clientId = data.clientId;
    });

    socket.on('enterPublicChannel', function(data) {
      addChannel('public', 'public', false);
    });

    socket.on('sendMessage', function(data) {
      var nickname = data.client.nickname;
      var message = data.message;
      if (data.channel == 'public') {
        nickname += '(Public)';
      }
      insertMessage(nickname, message, true, false, false);
    });

    socket.on('listMessage', function(data) {
      for (var index in data) {
        if (data[index].client.nickname == nickname) {
          insertMessage(data[index].client.nickname, data[index].message, true, true, false);
        } else {
          insertMessage(data[index].client.nickname, data[index].message, true, false, false);
        }
      }
    });

    socket.on('channelClients', function(data) {
      addChannel(data.channel, data.username, false);
      setCurrentChannel(data.channel);
      if (!login) {
        login = true;
        insertMessage(serverDisplayName, 'Welcome to MINET, you are in the public channel. Enjoy!', true, false, true);
      }
      $('.chat-clients ul').empty();
      addClient({ nickname: nickname, clientId: clientId }, false, true);
      for (var i = 0, len = data.clients.length; i < len; i++) {
	if (data.clients[i]) {
	  addClient(data.clients[i], false);
	}
      }
      $('.chat-shadow').animate({ 'opacity': 0 }, 200, function() {
	$(this).hide();
	$('.chat input').focus();
      });
    });

    socket.on('P2PClients', function(data) {
      addChannel(data.channel, data.username, false);
      setCurrentChannel(data.channel);
      $('.chat-clients ul').empty();
      addClient({ nickname: nickname, clientId: clientId }, false, true);
      for (var i = 0, len = data.clients.length; i < len; i++) {
	if (data.clients[i]) {
	  addClient(data.clients[i], false);
	}
      }
      $('.chat-shadow').animate({ 'opacity': 0 }, 200, function() {
	$(this).hide();
	$('.chat input').focus();
      });
    });

    socket.on('removeP2P', function(data) {
      if (currentChannel == data.channel) {
        setCurrentChannel('public');
      }
      removeP2P(data.channel);
    });
    
    socket.on('presence', function(data) {
      var announce;
      if (data.channel == 'public' && !login) {
        announce = true;
      } else {
        announce = false;
      }
      if (data.state == 'online' && data.channel == currentChannel) {
        $('.chat-clients ul li[data-clientId="' + data.client.clientId + '"]').remove();
	addClient(data.client, announce);
      } else if (data.state == 'offline') {
	removeClient(data.client, announce);
      }
    });
  }

  function addChannel(name, usr, announce) {
    name = name.replace('/', '');
    usr = usr.replace('/', '');
    // check if the channel is not already in the list
    if ($('.chat-channels ul li[data-channelId="' + name + '"]').length == 0) {
      $.tmpl(tmplt.channel, { channel: name , username: usr}).appendTo('.chat-channels ul');
    }
  }

  function removeP2P(name) {
    $('.chat-channels ul li[data-channelId="' + name + '"]').remove();
  }

  function addClient(client, announce, isMe) {
    var $html = $.tmpl(tmplt.client, client);
    if (isMe) {
      $html.addClass('me');
    }
    if (announce) {
      insertMessage(serverDisplayName, client.nickname + ' has joined MINET...', true, false, true);
    }
    $html.appendTo('.chat-clients ul');
  }

  // remove a client from the clients list
  function removeClient(client, announce) {
    $('.chat-clients ul li[data-clientId="' + client.clientId + '"]').remove();
    
    if (announce) {
      insertMessage(serverDisplayName, client.nickname + ' has left the MINET...', true, false, true);
    }
  }
  
  // sets the current channel when the client
  // makes a subscription
  function setCurrentChannel(channel) {
    currentChannel = channel;
    $('.chat-channels ul li.selected').removeClass('selected');
    $('.chat-channels ul li[data-channelId="' + channel + '"]').addClass('selected');
  }

  // save the client nickname and start the chat by
  // calling the 'connect()' function
  function handleNickname() {
    var nick = $('#nickname-popup .input input').val().trim();
    if (nick && nick.length <= NICK_MAX_LENGTH) {
      nickname = nick;
      Avgrund.hide();
      connect();
    } else {
      shake('#nickname-popup', '#nickname-popup .input input', 'tada', 'yellow');
      $('#nickname-popup .input input').val('');
    }
  }

  // handle the client messages
  function handleMessage() {
    var message = $('.chat-input input').val().trim();
    if (message) {
      // send the message to the server with the channel name
      socket.emit('sendMessage', { message: message, channel: currentChannel });
      // display the message in the chat window
      insertMessage(nickname, message, true, true);
      $('.chat-input input').val('');
    } else {
      shake('.chat', '.chat input', 'wobble', 'yellow');
    }
  }

  // insert a message to the chat window, this function can be
  // called with some flags
  function insertMessage(sender, message, showTime, isMe, isServer){
    var $html = $.tmpl(tmplt.message, {
      sender: sender,
      text: message,
      time: showTime ? getTime() : ''
    });

    // if isMe is true, mark this message so we can
    // know that this is our message in the chat window
    if (isMe) {
      $html.addClass('marker');
    }

    // if isServer is true, mark this message as a server
    // message
    if (isServer) {
      $html.find('.sender').css('color', serverDisplayColor);
    }
    $html.appendTo('.chat-messages ul');
    $('.chat-messages').animate({ scrollTop: $('.chat-messages ul').height() }, 100);
  }

  // return a short time format for the messages
  function getTime() {
    var date = new Date();
    return (date.getHours() < 10 ? '0' + date.getHours().toString() : date.getHours()) + ':' +
      (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes());
  }

  // just for animation
  function shake(container, input, effect, bgColor) {
    if (!lockShakeAnimation) {
      lockShakeAnimation = true;
      $(container).addClass(effect);
      $(input).addClass(bgColor);
      window.setTimeout(function(){
	$(container).removeClass(effect);
	$(input).removeClass(bgColor);
	$(input).focus();
	lockShakeAnimation = false;
      }, 1500);
    }
  }
  
  // after selecting a nickname we call this function
  // in order to init the connection with the server
  function connect() {
    // show connecting message
    $('.chat-shadow .content').html('Connecting...');
    
    // creating the connection and saving the socket
    socket = io.connect(serverAddress);
    
    // now that we have the socket we can bind events to it
    bindSocketEvents();
  }

  // on document ready, bind the DOM elements to events
  $(function() {
    bindDOMEvents();
  });
})(jQuery);