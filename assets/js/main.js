// TODO: put it all in a github repo

const DELETED_MSG_TEXT = "הודעה זו נמחקה";

// load the notification sound once
const msgNotifySound = new Audio("assets/sounds/msg-notification.wav");

$.settings = {
  allowSendingMsgs: true,

  allowConsoleLog: true,
  showConsoleLogLevelAndAbove: 0,
  showConsoleLogTrace: false,

  updateChatWithInterval: true,
  chatUpdateInterval: 5 * 1000,

  playIncommingMsgSound: true,
  incommingMsgSoundUrl:
    "https://sounddino.com//mp3/5/single-sound-message-icq-ooh.mp3",
  api_full_url: "./api.php?data=",
  defaultChatsLoadingLimiting: 6,
  defaultMsgsLoadingLimiting: 6,
  defaultProfilePicture: "./profile_pics/unknown.jpg",

  popupDefaultOptions: {
    animation: "none",
    title: false,
    content: false,
    theme: "supervan",
    columnClass: "col-md-12",
    backgroundDismiss: true,
    closeIcon: false,
    draggable: true,
  },
};

$.globals = {
  username: "assaf",
  loggedIn: true,
  lastTimeSentMsg: 0,
  isLoadingMsgs: 0,
  longPressTimer: null,
  thisContact: {
    profile_picture_url: null,
  },
};

$.intervals = {};

var mediaRecorder; // accessible by all functions in this script
var audioChunks = []; // persist recorded data until sending or canceling

var consoleLog = function (...args) {
  if (!$.settings.allowConsoleLog) {
    return false;
  }

  var level = 0;
  var type = "log";
  var showTrace = $.settings?.showConsoleLogTrace ?? false;

  if (args.length > 1) {
    var lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === "object") {
      if ("level" in lastArg) {
        level = lastArg.level;
      }

      if ("type" in lastArg) {
        type = lastArg.type;
      }

      if ("showTrace" in lastArg) {
        showTrace = lastArg.showTrace;
      }

      args.splice(args.length - 1, 1);
    }
  }

  const showLevel = $.settings?.showConsoleLogLevelAndAbove ?? 0;

  if (level === showLevel || level > showLevel) {
    switch (type) {
      default:
      case "log":
        console.log(...args);
        break;

      case "alert":
        popup(jsonEncode({ ...args }));
        break;

      case "info":
        console.info(...args);
        break;

      case "warn":
        console.warn(...args);
        break;

      case "error":
        console.error(...args);
        break;
    }

    if (showTrace) {
      console.trace();
    }
  }
};

var postToServer = async function ($arguments = null) {
  if (typeof $arguments !== "object") {
    var forceRoute = $arguments ?? "";
  }

  var postObj = $arguments?.data ?? arguments?.postObj ?? {};
  postObj.username = $arguments?.data?.username ?? $.globals.username;

  var route = forceRoute ?? $arguments?.route ?? "a";

  if (!route) {
    consoleLog(
      "you're trying to call postToServer function without route. route:",
      route,
      { level: 0 }
    );
    return false;
  }

  var url = $.settings.api_full_url + route;
  var method = $arguments?.method ?? "POST";
  var successCallback =
    $arguments?.successCallback ?? $arguments?.onSuccess ?? null;
  var errorCallback = $arguments?.errorCallback ?? null;
  var onAnywayCallback = $arguments?.onAnywayCallback ?? null;
  var asyncValue = $arguments?.async ?? true;

  $.ajax({
    url: url,
    method: method,
    data: postObj,
    async: asyncValue,
    xhrFields: { withCredentials: true },
    error: function (data) {
      console.log(data);

      if (data.status === 401) {
        popup({
          title: "Expired",
          content: "Your'e time has expired. Please log in again.",
          buttons: {
            Login: {
              text: "Log In",
              action: function () {
                window.location.replace("http://localhost:3000"); // Go to the login page
              },
            },
          },
        });
      }

      if (typeof errorCallback === "function") {
        errorCallback(data);
      }
    },
    success: function (data) {
      if (typeof successCallback === "function") {
        successCallback(data);
      }
    },
    complete: function (data) {
      if (typeof onAnywayCallback === "function") {
        onAnywayCallback(data);
      }
    },
  });
};

var base64Encode = function ($str) {
  try {
    return btoa(unescape(encodeURIComponent($str)));
  } catch (e) {
    console.error("base64Encode failed", e);
  }
};

var base64Decode = function ($str) {
  try {
    return decodeURIComponent(escape(atob($str)));
  } catch (e) {
    console.error("base64Decode failed", e);
  }
};

var jsonEncode = function ($obj) {
  return JSON.stringify($obj);
};

var jsonDecode = function ($json) {
  return JSON.parse($json);
};

var popup = function (options = null) {
  var defaultOptions = $.settings.popupDefaultOptions;
  var $content = false;

  if (typeof options !== "object") {
    var thisOptions = $.settings.popupDefaultOptions;
    thisOptions.content = options;
  } else {
    var thisOptions = { ...$.settings.popupDefaultOptions, ...options };
  }

  consoleLog("popup function fired with options:", options, { level: 0 });

  $.alert(thisOptions);
};

var countMsgsInActiveChat = function () {
  return $("#msgs").find(".message-box").length;
};

var proccessMsgsArr = async function (msgs) {
  var $msgs = msgs;

  if (!$msgs || $msgs.length === 0) {
    return false;
  }

  var $i = 0;

  var $msgsHTML = "";

  for (var $thisMsg in $msgs) {
    var $msg = $msgs[$i];

    var $msgId = $msg["row_id"];
    var $msgHTMLId = "msg_id_" + $msg["row_id"];
    var $msgContent = $msg["msg_body"] ?? null;
    var $msgDatetime = $msg["msg_datetime"];
    var $isFromMe = $msg["is_from_me"] ?? 0;
    var $msgType = $msg["msg_type"] ?? null;
    var $isFromMeOrOtherSideCssClass;
    var $msgDirection = "ltr"; // left to right

    if ($msgContent) {
      if (detectMainLanguage($msgContent) === "hebrew") {
        $msgDirection = "rtl"; // right to left
      }

      $msgContent = linkifyText($msgContent);
      $msgContent = putPhonesLinks($msgContent);
      $msgContent = newlinesToBr($msgContent);
    }

    if ($isFromMe === 1) {
      $isFromMeOrOtherSideCssClass = "my-message";
    } else {
      $isFromMeOrOtherSideCssClass = "friend-message";
    }

    if ($msgType == "image") {
      $msgContent = "";
      $msgContent += '<img src="' + $msg["msg_body"] + '" />';
    }

    if ($msgType == "e2e_notification") {
      continue;
    }

    if ($msgType == "notification_template") {
      continue;
    }

    if ($msgType === "video" && $media_file_url) {
      $msgContent = "";
      $msgContent += "<video controls>";
      $msgContent += '<source src="' + $msg["msg_body"] + '" type="video/mp4">';
      $msgContent += "</video>";
    }

    var $elm = "";

    if ($msgType == "revoked") {
      $elm += buildDeletedMessageBox(
        $msgHTMLId,
        $isFromMeOrOtherSideCssClass,
        DELETED_MSG_TEXT,
        $msgId
      );
    }

    if ($msgType === "audio") {
      $msgContent = $msg["msg_body"];

      $elm += buildVoiceMessageBox(
        $msgHTMLId,
        $isFromMeOrOtherSideCssClass,
        $msgDatetime,
        $msgId,
        $msgContent
      );
    }

    if ($msgType === "text") {
      $elm += buildTextMessageBox(
        $msgHTMLId,
        $isFromMeOrOtherSideCssClass,
        $msgDirection,
        $msgContent,
        $msgDatetime,
        $msgId
      );
    }

    $msgsHTML = $elm + $msgsHTML;
    ++$i;
  }

  return $msgsHTML;
};

var playIncommingMsgSound = async function () {
  if ($.settings.playIncommingMsgSound) {
    var audio = new Audio($.settings.incommingMsgSoundUrl);
    audio.play();
  }
};

var loadMsgsFromServerByContactId = async function (
  $prepend = 0,
  $contactId = null,
  $limit = null,
  $clearChatIfEmpty = 0
) {
  consoleLog("loadMsgsFromServerByContactId fired!");

  $.globals.isLoadingMsgs = 1;
  var $contactId = $contactId ?? $.globals.contactId;
  var $username = $.globals.username;

  var $numberOfCurrentMsgs = countMsgsInActiveChat() ?? 0;

  if ($prepend) {
    var $limit =
      $limit ??
      $numberOfCurrentMsgs + "," + $.settings.defaultMsgsLoadingLimiting;
  } else {
    var $limit = $limit ?? $.settings.defaultMsgsLoadingLimiting;
  }

  var loadTriggerHtml = '<div id="load_trigger">🔄</div>';
  var firstMsgId = $("#msgs").find(".message-box").first().attr("id");

  postToServer({
    route: "get_msgs",
    data: {
      username: $username,
      contact_id: $contactId,
      limit: $limit,
    },
    successCallback: async function (data) {
      if (!data || data.length == 0) {
        if (!$clearChatIfEmpty) {
          consoleLog(
            "loadMsgsFromServerByContactId returned empty string. That could be because there's no other msgs to load. data: ",
            data,
            { level: 3, type: "warn" }
          );
          return false;
        }

        $("#msgs").html(loadTriggerHtml);
        return;
      }

      var $html = await proccessMsgsArr(data);

      if ($prepend) {
        $("#msgs").prepend($html);
        $("#msgs").find("#load_trigger").remove();
        $("#msgs").prepend(loadTriggerHtml);
      } else {
        $html = loadTriggerHtml + $html;
        $("#msgs").html($html);

        clearInterval($.intervals.chatUpdateInterval);

        $.intervals.chatUpdateInterval = setInterval(async function () {
          if ($.settings.updateChatWithInterval) {
            loadNewMsgs();
          }
        }, $.settings.chatUpdateInterval);
      }

      $("#msgs audio").each(function () {
        var $this = $(this);
        var $elm_id = $this.attr("id") ?? null;

        var player = new Plyr("#" + $elm_id, {});
        window.player = player;
      });

      var player = new Plyr("audio", {});
      window.player = player;

      var d = $("#msgs");

      if (!$prepend) {
        d.scrollTop(d.prop("scrollHeight"));

        d.on("load", async function () {
          d.scrollTop(d.prop("scrollHeight"));
        });
      } else {
        try {
          if (firstMsgId) {
            document.getElementById(firstMsgId).scrollIntoView({
              behavior: "auto",
              block: "start",
            });

            d.on("load", async function () {
              document.getElementById(firstMsgId).scrollIntoView({
                behavior: "auto",
                block: "start",
              });
            });
          }
        } catch (e) {
          consoleLog(e, { level: 5, type: "error" });
        }
      }
    },
    onAnywayCallback: function () {
      getLastMsgId();
      $.globals.isLoadingMsgs = 0;
    },
  });
};

var getChats = async function (
  $append = false,
  $limit = null,
  $username = null
) {
  var $route = "get_chats";
  var $username = $username ?? $.globals.username ?? null;
  var $limit = $limit ?? $.settings.defaultChatsLoadingLimiting ?? null;

  if (!$username) {
    consoleLog("YOU TRIED TO RUN FUNCTION getChats WITHOUT username", {
      level: 0,
    });
    return false;
  }

  postToServer({
    route: $route,
    data: {
      username: $username,
      limit: $limit,
    },
    successCallback: async function (data) {
      $chats = data;
      consoleLog("chats", $chats, { level: 0 });
      var $i = 0;
      var $allChatsHtml = "";

      for (var $chat in $chats) {
        var $thisChat = $chats[$i];

        var $contactId = $thisChat["contact_id"];
        var $contactName =
          $thisChat["contact_name"] ??
          $thisChat["notify_name"] ??
          $contactId ??
          null;
        var $profilePicture =
          $thisChat["profile_picture_url"] ?? $.settings.defaultProfilePicture;
        var $lastMsgDatetime = $thisChat["msg_datetime"] ?? null;
        var $msgTime = $thisChat["msg_datetime"] ?? null;
        var $lastMsgBody = $thisChat["msg_body"] ?? "";

        var $chatType = $thisChat["msg_type"] ?? "text"; // extract the chat type

        var $contactInformation = {
          contactName: $contactName,
          profilePicture: $profilePicture,
        };

        var $jsonStrContactObj = jsonEncode($contactInformation);
        var $encodedContactInformation = base64Encode($jsonStrContactObj);

        // build the chat element
        var $elm = "";

        if ($chatType === "audio") {
          $elm = buildVoiceChatElement(
            $contactId,
            $encodedContactInformation,
            $profilePicture,
            $contactName,
            $msgTime
          );
        }
        if ($chatType === "revoked") {
          $elm = buildTextChatElement(
            $contactId,
            $encodedContactInformation,
            $profilePicture,
            $contactName,
            $msgTime,
            DELETED_MSG_TEXT
          );
        }
        if ($chatType === "text") {
          let $shortLastMsgBody = $lastMsgBody.substring(0, 30) + "...";
          $elm = buildTextChatElement(
            $contactId,
            $encodedContactInformation,
            $profilePicture,
            $contactName,
            $msgTime,
            $shortLastMsgBody
          );
        }

        $allChatsHtml += $elm;
        ++$i;
      }

      $allChatsHtml += "<div class='load_more_chats'>🔄</div>";

      $("#chats").find(".load_more_chats").remove();

      if (!$append) {
        $("#chats").html($allChatsHtml);
        $("#chats .chat").first().click();
      } else {
        $("#chats").append($allChatsHtml);
      }
    },
  });
};

var getMoreChats = async function () {
  var $currentChatsNum = $("#chats .chat").length;
  var $limit = $currentChatsNum + "," + $.settings.defaultChatsLoadingLimiting;
  getChats(true, $limit);
};

var refreshApp = async function () {
  $.globlas.username = localStorage.getItem("username");
  updateBotsList();
  getChats();
};

var resetAllForms = function () {
  $("body")
    .find("form")
    .each(function () {
      var $this = $(this);
      $this.trigger("reset");
    });

  $(".send_msg_form").removeClass("disabled");
};

var sendTxtMsg = async function (
  $msg = null,
  $contactId = null,
  $username = null,
  $time = 0
) {
  $(".send_msg_form").addClass("disabled");

  if ($.globals.isPendingMsg) {
    consoleLog(
      "you're trying to call sendTxtMsg while another proccess is running",
      { level: 2, type: "error" }
    );
    return false;
  }

  $.globals.isPendingMsg = 1;

  if (!$.settings.allowSendingMsgs) {
    consoleLog(
      "you're trying to call sendTxtMsg while $.settings.allowSendingMsgs is false",
      { level: 5, type: "error" }
    );
    $.globals.isPendingMsg = 0;
    return false;
  }

  if (!$msg) {
    consoleLog("you're trying to call sendTxtMsg width empty msg: ", $msg, {
      level: 5,
      type: "error",
    });
    $.globals.isPendingMsg = 0;
    return false;
  }

  var $username = $username ?? $.globals.username;

  if (!$username) {
    $.globals.isPendingMsg = 0;
    console.error("you're trying to send a txt msg without a username");
    return false;
  }

  var $contactId = $contactId ?? $.globals.contactId;

  if (!$contactId) {
    $.globals.isPendingMsg = 0;
    console.error("you're trying to send a txt msg without a contact id");
    return false;
  }

  var postData = {
    msg: $msg,
    username: $username,
    contact_id: $contactId,
    time: $time,
  };

  $.globals.lastTimeSentMsg = Date.now();

  postToServer({
    data: postData,
    route: "send_wa_txt_msg",
    successCallback: function (data) {
      $(".send_msg_form").removeClass("disabled");
      $.globals.isPendingMsg = 0;

      $.globals.lastMsgContent = $msg;
      resetAllForms();
      setTimeout(function () {
        loadMsgsFromServerByContactId();
        $.globals.isPendingMsg = 0;
        $(".send_msg_form").removeClass("disabled");
      }, 250);
    },
    onAnywayCallback: function () {
      $.globals.isPendingMsg = 0;
      $(".send_msg_form").removeClass("disabled");
    },
  });
};

// Function to start recording
var startVoiceRecording = async function () {
  console.log("Starting voice recording...");

  // remove any existing voice container
  $(".send-voice-container").remove();

  // Create the record ui
  var $container = $('<div class="background-container"></div>');
  var $buttonContainer = $('<div class="button-container"></div>');
  var $recordingIcon = $(`<i class="fa fa-microphone"></i>`);
  var $visualizer = $(`
  <div class="speaking-visualizer" aria-hidden="true">
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
    <span class="bar"></span>
  </div>
`);
  var $cancelBtn = $(
    '<button type="button" class="no-btn"><i class="fa fa-xmark"></i></button>'
  );
  var $sendBtn = $(
    '<button type="button" class="yes-btn"><i class="fa fa-check"></i></button>'
  );
  $container.append($recordingIcon, $visualizer);
  $buttonContainer.append($cancelBtn, $sendBtn);
  $container.append($buttonContainer);

  // Insert the container after the record button
  $("#recordVoice").after($container);

  // Start recording
  audioChunks = [];

  try {
    // Request mic access and get audio stream
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create AudioContext and AnalyserNode
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    // Start the visualizer animation and get the stop function
    const stopVisualizer = startVisualizerAnimation(analyser, $visualizer);

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = function (event) {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = function () {
      console.log("Recording stopped.");
      $sendBtn.prop("disabled", false);
    };

    mediaRecorder.start();
    console.log("Recording started.");

    // Cancel button stops recording and removes UI without sending
    $cancelBtn.on("click", function () {
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();

        // Stop the microphone stream completely
        stream.getTracks().forEach((track) => track.stop());
        audioContext.close();
        stopVisualizer(); // stop visualizer
      }
      $container.remove();
    });

    // Send button stops recording, converts to Base64, calls sendVoiceMsg, and removes UI
    $sendBtn.on("click", function () {
      if (mediaRecorder.state !== "inactive") {
        // When recording stops, this onstop handler will run:
        mediaRecorder.onstop = function () {
          console.log("Recording stopped.");
          $sendBtn.prop("disabled", false);

          // Stop the microphone stream completely
          stream.getTracks().forEach((track) => track.stop());
          audioContext.close();
          stopVisualizer(); // stop visualizer

          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

          // Play the recorded audio
          // const audioURL = URL.createObjectURL(audioBlob);
          // const audio = new Audio(audioURL);
          // audio.play();

          // Convert to base64 and send
          const reader = new FileReader();
          reader.onloadend = function () {
            const base64data = reader.result.split(",")[1];
            sendVoiceMsg(base64data);
          };
          reader.readAsDataURL(audioBlob);

          $container.remove(); // remove the voice recording ui
        };

        mediaRecorder.stop();
      } else {
        // Already stopped — handle accordingly or ignore
        console.warn("MediaRecorder is already stopped.");
      }
    });
  } catch (error) {
    console.error("Microphone access denied or error:", error);
    alert("Unable to access microphone.");
    $container.remove(); // remove the voice recording ui
  }
};

// Animate bars based on microphone input
var startVisualizerAnimation = function (analyser, $visualizer) {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const bars = $visualizer.find(".bar").toArray();
  let animationId;

  var animate = function () {
    analyser.getByteFrequencyData(dataArray);

    bars.forEach((bar, i) => {
      const index = Math.floor((i * dataArray.length) / bars.length);
      const value = dataArray[index];
      const height = 8 + (value / 255) * 36; // min 8px, max 40px
      bar.style.height = `${height}px`;
    });

    animationId = requestAnimationFrame(animate);
  };

  animate();

  // Return a function to stop the animation
  return () => cancelAnimationFrame(animationId);
};

var sendVoiceMsg = async function (
  base64Audio = null,
  $contactId = null,
  $username = null,
  $time = 0
) {
  $(".send_msg_form").addClass("disabled");

  if ($.globals.isPendingMsg) {
    consoleLog(
      "you're trying to call sendVoiceMsg while another process is running",
      { level: 2, type: "error" }
    );
    return false;
  }

  $.globals.isPendingMsg = 1;

  if (!$.settings.allowSendingMsgs) {
    consoleLog(
      "you're trying to call sendVoiceMsg while $.settings.allowSendingMsgs is false",
      { level: 5, type: "error" }
    );
    $.globals.isPendingMsg = 0;
    return false;
  }

  if (!base64Audio) {
    consoleLog("you're trying to call sendVoiceMsg with empty audio data", {
      level: 5,
      type: "error",
    });
    $.globals.isPendingMsg = 0;
    return false;
  }

  var $username = $username ?? $.globals.username;

  if (!$username) {
    $.globals.isPendingMsg = 0;
    console.error("you're trying to send a voice msg without a username");
    return false;
  }

  var $contactId = $contactId ?? $.globals.contactId;

  if (!$contactId) {
    $.globals.isPendingMsg = 0;
    console.error("you're trying to send a voice msg without a contact id");
    return false;
  }

  var postData = {
    audio_data: base64Audio,
    username: $username,
    contact_id: $contactId,
    time: $time,
  };

  $.globals.lastTimeSentMsg = Date.now();

  postToServer({
    data: postData,
    route: "send_wa_voice_msg",
    successCallback: function (data) {
      $(".send_msg_form").removeClass("disabled");
      $.globals.isPendingMsg = 0;

      $.globals.lastMsgContent = "[Voice message]";
      resetAllForms();
      setTimeout(function () {
        loadMsgsFromServerByContactId();
        $.globals.isPendingMsg = 0;
        $(".send_msg_form").removeClass("disabled");
      }, 250);
    },
    onAnywayCallback: function () {
      $.globals.isPendingMsg = 0;
      $(".send_msg_form").removeClass("disabled");
    },
  });
};

var getProfilePicByContactId = async function (
  $contactId = null,
  $username = null
) {
  var $contactId = $contactId ?? $.globals.contactId;
  var $username = $username ?? $.globals.username;

  consoleLog("getProfilePicByContactId fired with $contactId", $contactId, {
    level: 3,
  });

  postToServer({
    route: "get_profile_pic_by_contact_id",
    data: {
      contact_id: $contactId,
      username: $username,
    },
    successCallback: function (data) {
      try {
        var $url = data?.[0]?.[0] ?? $.settings.defaultProfilePicture;

        $.globals.thisContact.profile_picture_url = $url;
        $(".contact_profile_img img[data-contactId='" + $contactId + "']").attr(
          "src",
          $url
        );

        consoleLog(
          $(".contact_profile_img img[data-contactId='" + $contactId + "']"),
          { level: 0 }
        );

        $("img.contact_profile_img[data-contactId='" + $contactId + "']").attr(
          "src",
          $url
        );
        $(
          ".chat[data-contactId='" +
            $contactId +
            "'] .contact_profile_img_container img"
        ).attr("src", $url);
      } catch (e) {
        consoleLog(e, { level: 5, type: "error" });
      }
    },
    onAnywayCallback: function () {},
  });
};

var deleteMessageHandler = function (msgId) {
  popup({
    content: "Are you sure you want to delete this message?",
    title: "Delete Message",
    buttons: {
      yes: {
        text: "Yes",
        action: function () {
          postToServer({
            route: "delete_wa_msg",
            data: {
              msg_id: msgId,
            },
            successCallback: function (data) {
              if (data.success) {
                consoleLog("Message deleted successfully", { level: 0 });

                // Replace the message content with the deleted text
                const $msgBox = $("#msg_id_" + msgId);

                // Change the text content inside the message box
                $msgBox.find("p.content").html(DELETED_MSG_TEXT);
              } else {
                consoleLog("Failed to delete message", {
                  level: 2,
                  type: "error",
                });
              }
            },
            onAnywayCallback: function () {},
          });
        },
      },
      no: {
        text: "No",
        action: function () {},
      },
    },
  });
};

var getContactNameById = async function ($contactId = null, $username = null) {
  var $contactId = $contactId ?? $.globals.contactId;
  var $username = $username ?? $.globals.username;

  consoleLog("getContactNameById fired with $contactId", $contactId, {
    level: 3,
  });

  postToServer({
    route: "get_contact_name_by_contact_id",
    data: {
      contact_id: $contactId,
      username: $username,
    },
    successCallback: function (data) {
      try {
        var $contactName = data?.[0]?.[0] ?? "";
        $(".contact_name").text($contactName);
        $.globals.contactName = $contactName;
      } catch (e) {
        consoleLog(e, { level: 5, type: "error" });
      }
    },
    onAnywayCallback: function () {},
  });
};

var goToChat = async function ($contactId) {
  $(".send_msg_form").removeClass("disabled");

  $("#chat_window .contact_profile_img img").attr("data-contactId", $contactId);

  getProfilePicByContactId($contactId);
  getContactNameById($contactId);

  $(".contact_id").text($contactId);
  $.globals.contactId = $contactId;

  $("#chat_window").addClass("visable");
  loadMsgsFromServerByContactId(
    false,
    $contactId,
    $.settings.defaultMsgsLoadingLimiting,
    1
  );
};

var getLastMsgId = function () {
  var $lastMsgId = $("#msgs .message-box").last().find(".msg_id").text();
  if ($lastMsgId) {
    $.globals.lastMsgId = $lastMsgId;
    return $.globals.lastMsgId;
  }
  return null;
};

var loadNewMsgs = async function ($contactId = null) {
  consoleLog("loadNewMsgs fired!");

  $.globals.isLoadingMsgs = 1;
  var $contactId = $contactId ?? $.globals.contactId;
  var $username = $username ?? $.globals.username;
  var $lastMsgId = getLastMsgId() ?? $.globals.lastMsgId ?? null;

  if (!$lastMsgId) {
    consoleLog(
      "You're trying to call loadNewMsgs but can't figure out what's the lastMsgId: ",
      $lastMsgId
    );
    return false;
  }

  postToServer({
    route: "get_new_msgs",
    data: {
      contact_id: $contactId,
      username: $username,
      last_id: $lastMsgId,
    },
    successCallback: function (data) {
      if (!data || data.length == 0) {
        consoleLog("no new msgs", { level: 0 });
        return;
      }

      var $html = proccessMsgsArr(data);

      $("#msgs").append($html);

      // Play notification sound on new messages
      msgNotifySound.play().catch((e) => {
        // Handle autoplay restrictions or errors gracefully
        console.log("Could not play notification sound:", e);
      });
    },
    onAnywayCallback: function () {
      getLastMsgId();
      $.globals.isLoadingMsgs = 0;
    },
  });
};

var linkifyText = function (text) {
  var urlRegex = /((https?:\/\/|www\.)[^\s<>"']+)/g;

  var replacedText = text.replace(urlRegex, function (match) {
    var href = match;

    if (!/^https?:\/\//.test(href)) {
      href = "http://" + href;
    }

    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });

  return replacedText;
};

var newlinesToBr = function (text) {
  return text.replace(/(\r\n|\n|\r)/g, "<br/>");
};

var detectMainLanguage = function (text) {
  var hebrewMatches = text.match(/[\u0590-\u05FF]/g) || [];
  var englishMatches = text.match(/[a-zA-Z]/g) || [];

  var hebrewCount = hebrewMatches.length;
  var englishCount = englishMatches.length;

  if (hebrewCount > englishCount) {
    return "hebrew";
  } else if (englishCount > hebrewCount) {
    return "english";
  } else {
    return "english";
  }
};

var putPhonesLinks = function (text) {
  var phoneRegex = /\d{9,}/g;

  // נחלק את הטקסט לחלקים: כאלה שעטופים בתגיות a וכאלה שלא
  var parts = text.split(/(<a [^>]*>.*?<\/a>)/g);

  // נעבור על כל החלקים
  for (var i = 0; i < parts.length; i++) {
    // אם זה לא לינק - נעשה החלפה
    if (!parts[i].startsWith("<a ")) {
      parts[i] = parts[i].replace(phoneRegex, function (match) {
        return (
          '<a href="#" class="goToChat" data-contactId="' +
          match +
          '@c.us">' +
          match +
          "</a>"
        );
      });
    }
  }

  // נחבר את הכל בחזרה
  return parts.join("");
};

var disableMsgsUpdateInterval = function () {
  $.settings.updateChatWithInterval = false;
};

var enableMsgsUpdateInterval = function () {
  $.settings.updateChatWithInterval = false;
};

$(document).ready(function () {
  consoleLog("document ready", { level: 0 });
});

$(window).on("load", function () {
  consoleLog("window loaded", { level: 0 });

  getChats();

  $("body").on("click", ".show_chats_list", function () {
    $("#chat_window").removeClass("visable");
  });

  $("body").on("click", ".goToChat", function () {
    var $contactId = $this.attr("data-contactId");
    $(".contact_id").text($contactId);

    $.globals.contactId = $contactId;

    $("#chat_window").addClass("visable");

    loadMsgsFromServerByContactId(false);
  });

  $("body").on("click", "#chats .chat", function () {
    var $this = $(this);

    $("#chats .chat").removeClass("active");
    $this.addClass("active");

    var $encodedContactInformation =
      $this.attr("data-contactInformation") ?? null;

    if ($encodedContactInformation) {
      $.globals.thisContact = jsonDecode(
        base64Decode($encodedContactInformation)
      );
    }

    var $profilePicture =
      $.globals.thisContact?.profile_picture_url ??
      $.settings.defaultProfilePicture ??
      null;
    var $contactName =
      $.globals.thisContact?.name ?? $.globals.thisContact?.notify_name ?? null;

    $(".contact_profile_img img").attr("src", $profilePicture);
    $(".contact_name_container .contact_name").text($contactName);

    var $contactId = $this.attr("id");
    consoleLog($contactId, { level: 0 });

    goToChat($contactId);
  });

  $("body").on(
    "click",
    ".user_avatar_container, .contact_profile_img",
    async function () {
      getProfilePicByContactId();
      var $imgUrl = $(this).find("img").attr("src");
      var $imgTag = "<img class='contact_profile_img' src='" + $imgUrl + "' />";

      popup($imgTag);
    }
  );

  $("body").on("click", ".message-box .content img", function () {
    var $this = $(this);
    var $img_url = $this.attr("src");
    var $img_tag = "<img class='full_height_img' src='" + $img_url + "' />";

    popup($img_tag);
  });

  $("body").on("click", "#load_trigger", function () {
    loadMsgsFromServerByContactId(true);
  });

  $("body").on("click", ".logout", async function () {
    popup({
      content: "Are you sure you wanna logout?",
      buttons: {
        yes: {
          text: "Yes",
          action: function () {
            postToServer({
              route: "logout_user",
              data: { username: $.globals.username },
              successCallback: (res) => {
                console.log(res);

                if (res.success) {
                  window.location.replace("http://localhost:3000"); // Redirect to login
                }
              },
              errorCallback: (err) => {
                console.log(err);

                consoleLog("Logout failed: " + err, {
                  level: 5,
                  type: "error",
                });

                popup({ content: "Logout failed. Please try again." });
              },
            });
          },
        },
        no: {
          text: "No",
          action: function () {},
        },
      },
    });
  });

  $("body").on("submit", "#send_msg", function (e) {
    e.preventDefault();
    var $msg = $("#send_msg #msg").val();
    if (!$(this).hasClass("disabled")) {
      sendTxtMsg($msg);
    }
  });

  // Handle voice recording
  $("body").on("click", "#recordVoice", function (e) {
    e.preventDefault();
    if (!$(this).hasClass("disabled")) {
      startVoiceRecording();
    }
  });

  // Handle hearing a voice message
  $("body").on("click", ".voice-msg-btn", function (e) {
    e.preventDefault();

    var $btn = $(this);
    var $icon = $btn.find("i"); // Get the icon element

    // If the icon is currently "stop", it means audio is playing and should stop it
    if ($icon.hasClass("fa-stop")) {
      var audio = $btn.data("audioObj");
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      $btn.removeData("audioObj");
      $icon.removeClass("fa-stop").addClass("fa-play");
      return;
    }

    // Otherwise, start playing new audio
    var base64Audio = $btn.data("base64audio");
    if (!base64Audio.startsWith("data:audio")) {
      base64Audio = "data:audio/wav;base64," + base64Audio;
    }

    var audio = new Audio(base64Audio);
    $btn.data("audioObj", audio);

    // Change icon to stop while playing
    $icon.removeClass("fa-play").addClass("fa-stop");

    // When finished, reset icon
    audio.addEventListener("ended", function () {
      $icon.removeClass("fa-stop").addClass("fa-play");
      $btn.removeData("audioObj");
    });

    audio.play();
  });

  $("body").on("click", ".load_more_chats", function () {
    getMoreChats();
  });
});

// Handle deleting messages
$("body").on("click", ".delete-msg-btn", function (e) {
  e.preventDefault();
  var $this = $(this);
  var $msgBox = $this.closest(".message-box");
  var $msgId = $msgBox.find(".msg_id").text();

  if (!$msgId) {
    consoleLog("No message ID found for deletion", { level: 5, type: "error" });
    return;
  }

  deleteMessageHandler($msgId);
});

// ui templates functions:
var buildTextChatElement = function (
  contactId,
  encodedContactInformation,
  profilePicture,
  contactName,
  msgTime,
  shortLastMsgBody
) {
  return `
    <div id="${contactId}" class="chat chat-box" 
         data-contactInformation="${encodedContactInformation}" 
         data-contactId="${contactId}">
      <div class="img-box contact_profile_img_container">
        <img class="img-cover" src="${profilePicture}" alt="">
      </div>
      <div class="chat-details">
        <div class="text-head">
          <h4>${contactName}</h4>
          <p class="time">${msgTime}</p>
        </div>
        <div class="text-message">
          <p>${shortLastMsgBody}</p>
        </div>
      </div>
    </div>
  `;
};

var buildVoiceChatElement = function (
  contactId,
  encodedContactInformation,
  profilePicture,
  contactName,
  msgTime
) {
  return `
    <div id="${contactId}" class="chat chat-box" 
         data-contactInformation="${encodedContactInformation}" 
         data-contactId="${contactId}">
      <div class="img-box contact_profile_img_container">
        <img class="img-cover" src="${profilePicture}" alt="">
      </div>
      <div class="chat-details">
        <div class="text-head">
          <h4>${contactName}</h4>
          <p class="time">${msgTime}</p>
        </div>
        <div class="text-message">
          <p><הודעה קולית></p>
        </div>
      </div>
    </div>
  `;
};

var buildTextMessageBox = function (
  msgHTMLId,
  isFromMeOrOtherSideCssClass,
  msgDirection,
  msgContent,
  msgDatetime,
  msgId
) {
  return `
    <div id="${msgHTMLId}" class="message-box ${isFromMeOrOtherSideCssClass}">
      <p class="content ${msgDirection}">
        ${msgContent}
        <br/>
        <span class="datetime">
          ${msgDatetime}
          ${
            isFromMeOrOtherSideCssClass === "my-message"
              ? `<button class="delete-msg-btn" title="Delete message" aria-label="Delete message">
                  <i class="fa fa-trash"></i>
                </button>`
              : ""
          }
        </span>
        <span class="msg_id">${msgId}</span>
      </p>
    </div>
  `;
};

var buildVoiceMessageBox = function (
  msgHTMLId,
  isFromMeOrOtherSideCssClass,
  msgDatetime,
  msgId,
  base64Audio
) {
  return `
  <div id="${msgHTMLId}" class="message-box ${isFromMeOrOtherSideCssClass}">
    <p class="content voice-message">
      <span>הודעה קולית</span>
      <button
        class="voice-msg-btn"
        data-base64audio="data:audio/wav;base64,${base64Audio}"
      >
        <i class="fa fa-play"></i>
      </button>
      <span class="datetime">
        <button
          class="delete-msg-btn"
          title="Delete message"
          aria-label="Delete message"
        >
          <i class="fa fa-trash"></i>
        </button>
        ${msgDatetime}
      </span>
      <span class="msg_id">${msgId}</span>
    </p>
  </div>
  `;
};

var buildDeletedMessageBox = function (
  msgHTMLId,
  isFromMeOrOtherSideCssClass,
  msgContent,
  msgId
) {
  return `
    <div id="${msgHTMLId}" class="message-box ${isFromMeOrOtherSideCssClass}">
      <p class="content">${msgContent}
      <span class="msg_id">${msgId}</span>
      </p>
    </div>
    `;
};
