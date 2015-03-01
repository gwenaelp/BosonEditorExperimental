/*
 * Boson.js core
 * This handles all core app things.
*/

var gui = require('nw.gui');
var menu = require(process.cwd() + '/core/modules/menu.js');
var keybindings = require(process.cwd() + '/core/modules/keybindings.js');
var livepreview = require(process.cwd() + '/core/modules/livepreview.js');
var fs = require('fs');
var path = require('path');

(function(window,config){

  var boson = {
    current_editor: null,
    title: "Boson Editor",
    working_dir: process.env.PWD
  }, elements = {}, editor = [], tabs = [], dom, editorData = [], win;

  this.preloadDom = function() {
    elements.editorEntryPoint = document.getElementById("editor-entrypoint");
    elements.tabsEntryPoint = document.getElementById("tabs-entrypoint");
    elements.bodyEntryPoint = document.getElementById("body-entrypoint");
    elements.selectFilesInput = document.getElementById("boson-select-files");

    //Hook on change selectFilesInput.
    elements.selectFilesInput.addEventListener("change", function(res){
      bs.attemptOpenFiles(this.value);
    }, false);
  };

  this.log = function(buffer) {

    console.log(buffer);

  };

  this.attemptOpenFiles = function( fp ) {

    var files;

    //Split the string, check if multiple files have been selected.
    files = fp.split(";");

    for ( key in files ) {
      bs.openFileFromPath( files[key] );
    }

  };

  this.fileExtensionToMode = function ( ext ) {

    var mode = false;

    switch ( ext ) {
      case ".html":
        mode = "htmlmixed";
      break;
      case ".htm":
        mode = "htmlmixed";
      break;
      case ".php":
        mode = "php";
      break;
      case ".js":
        mode = "javascript";
      break;
      case ".sass":
        mode = "sass";
      break;
      case ".scss":
        mode = "sass";
      break;
      case ".css":
        mode = "css";
      break;
    }

    return mode;

  };

  this.openFileFromPath = function( fp ) {

    var key, cfp, currentFileId;

    if ( typeof fp === "undefined" || fp === "" ) {
      bs.bsError("Tried to open file with blank filepath.");
      return;
    }

    //Is the file currently open?
    for ( key in editorData ) {
      cfp = editorData[key].cwd + "/" + editorData[key].name;
      if ( cfp === fp ) {
        //File is already open.
        bs.log("File already open, switching to tab.");
        bs.switchToEditor( key );
        return;
      }
    }

    //Open the file.
    fs.exists(fp, function (exists) {
      if ( exists ) {

        //Open the file buffer.
        fs.readFile(fp, {
          encoding: "utf-8"
        }, function(err, data){

          if ( err ) {
            bs.bsError("There was an error opening " + fp);
            return;
          }

          currentFileId = editorData.length;

          //Open new tab.
          editorData.push({
            name: path.basename(fp),
            guid: fp,
            cwd: path.dirname(fp),
            buffer: data
          });

          this.createEditor(editorData[currentFileId], currentFileId, true);

        });

      } else {
        bs.bsError("Tried to open file that doesn't exist, " + fp);
        return;
      }
    });

  };

  this.openFileDialogue = function() {

    elements.selectFilesInput.click();

  };

  this.createTab = function(object, i) {

    var tab;

    tab = document.createElement("li");
    tab.id = "tab-" + object.guid;
    tab.innerHTML = object.name;
    tab.setAttribute("data-name", object.name);

    //Hook onclick.
    tab.onmousedown = function(e) {
      e.preventDefault();
      bs.switchToEditor(i);
    };

    elements.tabsEntryPoint.appendChild( tab );

    tabs[i] = tab;

  };

  this.activateTab = function(i) {
    if ( boson.current_editor !== null && boson.current_editor !== false ) {
      tabs[boson.current_editor].className = "";
    }
    tabs[i].className =  "active";
  }

  this.createEditor = function(object, i, activateOnComplete) {

    var textarea, cmMode;

    //Create the textarea.
    textarea = document.createElement("textarea");
    textarea.id = "ta-" + object.guid;
    textarea.value = object.buffer;

    //Create a tab.
    this.createTab(object, i);

    //Inject into DOM.
    elements.editorEntryPoint.appendChild(textarea);

    //Try to find file type mode for CM.
    cmMode = bs.fileExtensionToMode( path.extname( editorData[i].name ) );
    console.log(cmMode);
    //Create the editor.
    editor[i] = {
      cm: CodeMirror.fromTextArea(textarea, {
          lineNumbers: true,
          theme: config.theme,
          mode: cmMode
        }),
      ta: textarea,
      changed: false
    };

    //Hide the editor.
    editor[i].cm.getWrapperElement().style.display = "none";

    //Create on change hook for save notifications.
    editor[i].cm.on("change", function(cm) {
      if ( editor[i].changed === false ) {
         this.flagHasChanged(i, true);
      }
    });

    if ( typeof activateOnComplete !== "undefined" ) {
      if ( activateOnComplete === true ) {
        bs.switchToEditor(i);
      }
    }

  };

  this.closeEditor = function(i) {

    //Remove the CM element.
    editor[i].cm.toTextArea();

    //Remove the text area.
    editor[i].ta.parentElement.removeChild(editor[i].ta);

    //Remove the tab.
    tabs[i].parentElement.removeChild(tabs[i]);


    //Clear the editor object.
    editor[i] = {};
    editorData[i] = {};
    tabs[i] = null;

    boson.current_editor = false;
    bs.setTitle("Nothing open");

    //Find another editor to activate.
    bs.findAndActivateTab(i);

  };

  this.findAndActivateTab = function(i) {

    var newTab = false, max, x;

    max = editorData.length - 1;

    for ( x = max; x >= 0; x-- ) {
      if ( editorData[x].hasOwnProperty('name') ) {
        newTab = x;
        break;
      }
    }

    if ( newTab !== false ) {
      bs.switchToEditor(x);
    }

  };

  this.showEditor = function(i) {

    editor[i].cm.getWrapperElement().style.display = "block";
    editor[i].cm.focus();

  }

  this.hideEditor = function(i) {

    if ( i !== false ) {
      editor[i].cm.getWrapperElement().style.display = "none";
    }

  }

  this.switchToEditor = function(i) {
    if ( boson.current_editor !== i ) {
      if ( boson.current_editor !== null ) {
        this.hideEditor(boson.current_editor)
      }
      this.showEditor(i);
      this.activateTab(i);
      boson.current_editor = i;
      if ( editor[i].changed === true ) {
        this.setTitle( editorData[i].cwd + "/" + editorData[i].name + " *" );
      } else {
        this.setTitle( editorData[i].cwd + "/" + editorData[i].name );
      }
    }
  };

  this.createPopupDialogue = function(title, message, accept, decline, onSuccess, onFailure, i) {

    var popup, popup_logo, popup_title, popup_description, popup_accept_button, popup_decline_button;

    popup = document.createElement("div");
    popup.className = "popup prompt";

    popup_logo = document.createElement("div");
    popup_logo.className = "logo";

    popup_title = document.createElement("h4");
    popup_title.innerHTML = title;

    popup_description = document.createElement("div");
    popup_description.className = "dialogue";
    popup_description.innerHTML = message;

    popup_accept_button = document.createElement("button");
    popup_accept_button.className = "btn btn-accept";
    popup_accept_button.innerHTML = accept;

    popup_decline_button = document.createElement("button");
    popup_decline_button.className = "btn btn-decline";
    popup_decline_button.innerHTML = decline;

    popup_accept_button.addEventListener("click", function(e){
      e.preventDefault();
      onSuccess(i);
      bs.removePopupDialogue(popup);
    });

     popup_decline_button.addEventListener("click", function(e){
      e.preventDefault();
      onFailure(i);
      bs.removePopupDialogue(popup);
    });

    popup.appendChild(popup_logo);
    popup.appendChild(popup_title);
    popup.appendChild(popup_description);
    popup.appendChild(popup_decline_button);
    popup.appendChild(popup_accept_button);

    elements.bodyEntryPoint.appendChild(popup);

  };

  this.removePopupDialogue = function(popup) {

    popup.className = "popup prompt popOut";
    setTimeout(function(){
      popup.parentElement.removeChild(popup);
    }, 150);

  };

  this.warnSave = function(i, onSuccess, onFailure) {

    var dialogueMessage;

    dialogueMessage = "Do you want to save " + editorData[i].name + " before closing it?";

    this.createPopupDialogue("Save before closing?", dialogueMessage, "Save", "Don't save", onSuccess, onFailure, i);

  };

  this.closeCurrentTab = function() {

    if ( boson.current_editor === null || boson.current_editor === false ) {
      return;
    }

    if ( editor[boson.current_editor].changed === true ) {
      //Confirm save.
      this.warnSave(boson.current_editor, function(i){
        //On save.
        bs.saveCurrentBuffer(function(){
          bs.closeEditor(boson.current_editor);
        });

      }, function(i){
        //On not save.
        bs.closeEditor(boson.current_editor);

      });
    } else {
      this.closeEditor(boson.current_editor);
    }

  };

  this.bsError = function(err) {
    console.log("BOSON ERROR: " + err);
  };

  this.flagHasChanged = function(i, status) {

    editor[i].changed = status;

    if ( status === true ) {
      //Set both tab title and window title.
      tabs[i].innerHTML = tabs[i].getAttribute("data-name") + "*";
      this.setTitle( editorData[i].cwd + "/" + editorData[i].name + " *" );
    } else {
      //Set both tab title and window title.
      tabs[i].innerHTML = tabs[i].getAttribute("data-name");
      this.setTitle( editorData[i].cwd + "/" + editorData[i].name );
    }

  };

  this.saveBuffer = function(i, callback) {

    //Save the specified buffer changes to buffer.
    var fh, fileBuffer;

    //Sync Codemirror and editorData.
    editorData[i].buffer = editor[i].cm.getValue();

    fileBuffer = editorData[i];

    fs.writeFile( fileBuffer.cwd + "/" + fileBuffer.name, fileBuffer.buffer, function(err){
      if ( err ) {
        this.bsError(err);
      }
      this.log("Saved buffer  to " + fileBuffer.cwd + "/" + fileBuffer.name );

      //Remove the "changed" symbol and flag.
      this.flagHasChanged(i, false);

      if ( typeof callback === "function" ) {
        callback();
      }

    });

  };

  this.saveCurrentBuffer = function(callback) {

    
    if ( typeof callback === "function" ) {
      this.saveBuffer(boson.current_editor, callback);
    } else {
      this.saveBuffer(boson.current_editor);
    }

  };

  this.setTitle = function(titleBuffer) {

    var proposedTitle;

    proposedTitle = titleBuffer + " - Boson Editor";

    if ( boson.title !== proposedTitle ) {
      //Set title.
      gui.Window.get().title = proposedTitle;
      boson.title = proposedTitle;
    }

  }

  this.debug = function() {
    win.showDevTools();
  };

  this.reinit = function() {
    win.reload();
  };

  this.init = function() {

    var startupTime, bootUpTime, totalBootTime, i, fileCount;

    //Log the startup time.
    startupTime = new Date().getTime();


    //Debug only.
    //This should read data file.
    editorData.push({
      name: "index.html",
      guid: "7812tg87gas87dgasd",
      cwd: "/home/dampe/public_html",
      buffer: "asd967asdg978asvdbasd"
    });
    editorData.push({
      name: "editor.html",
      guid: "abcdefghj",
      cwd: "/home/dampe/public_html",
      buffer: "asd967asdg97asdasdasdasdasdasdasd"
    });

    //Preload dom selection.
    this.preloadDom();

    fileCount = editorData.length;
    for ( i=0; i<fileCount; i++ ) {
      this.createEditor(editorData[i], i);
    }

    //Fetch window.
    win = gui.Window.get();

    //Build menus.
    menu.init(gui,win,this);
    keybindings.init(gui,win,this);
    livepreview.init(gui,win,this);

    //Show the window.
    win.show();

    bootUpTime = new Date().getTime();
    totalBootTime = bootUpTime - startupTime;

    if ( boson.current_editor === null ) {
      if ( fileCount >= 1 ) {
        this.switchToEditor(fileCount -1);
      }
    }

    this.log("Boot complete, " + totalBootTime + " ms");

  };

  window.bs = this;
  this.init();

})(window, {
  theme: "ambiance"
});