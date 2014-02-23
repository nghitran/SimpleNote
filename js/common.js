var App = new function() {
    var self = this,
        cards = null, user = null,
        $notebooksList = null, elButtonNewNote = null,
        createNoteOnTap = false,
        
        DEBUG = window.location.href.indexOf('DEBUG=1') !== -1,
        LOGGER_NAMESPACE = "DOAT-NOTES",
        TIME_FOR_NEW_NOTE_DOUBLECLICK = 200,
        NUMBER_OF_SCROLL_RETRIES = 10,
        EMPTY_CONTENT_CLASS = "show-empty",
        CLASS_EDIT_TITLE = "edit-title",
        CLASS_SEARCH_RESULTS = "search-results",
        CLASS_LOADING = "loading",
        DEFAULT_USER = {
            "id": "1",
            "username": "default",
            "name": "default"
        },
        TEXTS = null,
        ORDERS = null,
        INFO_FIELDS = null,
        SEARCH_FIELDS = ["text", "title"];
    
    this.init = function() {
        DEBUG && Console.init(LOGGER_NAMESPACE);
        
        setupCache();
        self.setupTexts();
        
        cards = new Cards({
            "onMove": onCardMove
        });
        
        // handler of the notebook card (list of notes)
        NotebookView.init({
            "container": $("main"),
            "onClickNote": self.showNote,
            "onChange": NotebooksList.refresh
        });
        // handler of the note card (view and edit actual note)
        NoteView.init({
            "container": $("note"),
            "elEdit": $("button-note-edit"),
            "onEdit": onNoteEdit,
            "onRestore": onNoteRestore,
            "onDelete": onNoteDelete,
            "NoteActionsPhotoLabel": TEXTS.PHOTO_LABEL
        });
        // handler of the note card (view and edit actual note)
        NoteForm.init({
            "container": $("note-form"),
            "elCancel": $("note-form-cancel"),
            "elSave": $("note-form-save"),
            "onSave": onNoteSave,
            "onCancel": onNoteCancel,
        });
        // handler of the note-info card
        NoteInfoView.init({
            "container": $("note-info"),
            "fields": INFO_FIELDS,
            "onNotebookChange": onNoteChangeNotebook
        });
        // handles the sorting of notebooks
        Sorter.init({
            "orders": ORDERS,
            "container": $("notebook-footer"),
            "onChange": function(order, desc) {
                NotebookView.showNotes(order, desc);
            }
        });
        // general object to show notifications on screen
        Notification.init({
            "container": $("container")
        });
        
        Searcher.init({
            "input": $("searchNotes"),
            "fields": SEARCH_FIELDS,
            "onSearch": SearchHandler.onSearch,
            "onInputFocus": SearchHandler.onFocus,
            "onInputBlur": SearchHandler.onBlur
        });
        
        // list of notebooks
        NotebooksList.init({
            "container": $("notebooks"),
            "onClick": onNotebookClick,
            "onRefresh": NoteInfoView.refreshNotebooks,
            "onRename": onNotebookRename,
            "onDelete": onNotebookDelete
        });
        
        
        elButtonNewNote = $("button-notebook-add");
        
        $("button-new-notebook").addEventListener("click", self.promptNewNotebook);
        
        $("button-notebook-search").addEventListener("click", SearchHandler.open);
        
        elButtonNewNote.addEventListener("click", function() {
            self.newNote();
        });
        
        DB.init(initUser);

        document.addEventListener('localechange', function(){
            navigator.mozL10n.ready(function(){
                self.setupTexts();
            });
        }, false);

        document.body.classList.remove(CLASS_LOADING);        
    };
    
    function setupCache() {
        window.applicationCache.addEventListener('updateready', function onCacheUpdated() {
            window.applicationCache.swapCache();
            window.location.reload();
        }, false);
    }
    
    function initUser(){
        DB.getUsers({"id": DEFAULT_USER.id}, function onSuccess(users) {
            if (users.length === 0) {
                user = new User(DEFAULT_USER);
                DB.addUser(user, function onSuccess() {
                    self.getUserNotes();
                });
            } else {
                user = users[0];
                self.getUserNotes();
            }
        });
    }

    this.setupTexts = function() {
        TEXTS = {
            "NEW_NOTEBOOK": navigator.mozL10n.get("new-notebook"),
            "NOTEBOOK_ALL": navigator.mozL10n.get("notebook-all"),
            "NOTEBOOK_TRASH": navigator.mozL10n.get("notebook-trash"),
            "NOTEBOOK_ACTION_TITLE": navigator.mozL10n.get("notebook-action-title"),
            "NOTEBOOK_ACTION_RENAME": navigator.mozL10n.get("notebook-action-rename"),
            "NOTEBOOK_ACTION_DELETE": navigator.mozL10n.get("notebook-action-delete"),
            "PROMPT_RENAME_NOTEBOOK": navigator.mozL10n.get("prompt-rename-notebook"),
            "PROMPT_DELETE_NOTEBOOK": navigator.mozL10n.get("prompt-delete-notebook"),
            "NOTE_RESTORED": navigator.mozL10n.get("note-restored"),
            "NEW_NOTE": navigator.mozL10n.get("new-note"),
            "EMPTY_NOTEBOOK": navigator.mozL10n.get("empty-notebook"),
            "EMPTY_TRASH": navigator.mozL10n.get("empty-trash"),
            "FIRST_NOTEBOOK_NAME": navigator.mozL10n.get("first-notebook-name"),
            "EMPTY_NOTEBOOK_NAME": navigator.mozL10n.get("empty-notebook-name"),
            "NOTE_CANCEL_CHANGES": navigator.mozL10n.get("note-cancel-changes"),
            "CONFIRM_TRASH_NOTE": navigator.mozL10n.get("confirm-trash-note"),
            "CONFIRM_DELETE_NOTE": navigator.mozL10n.get("confirm-delete-note"),
            "ADD_IMAGE_TITLE": navigator.mozL10n.get("add-image-title"),
            "IMAGE_NOT_SUPPORTED": navigator.mozL10n.get("image-not-supported"),
            "PHOTO_LABEL": navigator.mozL10n.get("image-label")
        };

        ORDERS = [
            {
                "property": "date_updated",
                "label": navigator.mozL10n.get("date-updated"),
                "descending": true
            },
            {
                "property": "date_created",
                "label": navigator.mozL10n.get("date-created"),
                "descending": true
            },
            {
                "property": "title",
                "label": navigator.mozL10n.get("title"),
                "descending": false
            },
            {
                "property": "notebook_id",
                "label": navigator.mozL10n.get("notebook"),
                "descending": false
            }
        ];
        
        INFO_FIELDS = [
            {
                "key": "notebook_id",
                "label": navigator.mozL10n.get("notebook"),
                "type": "options"
            },
            {
                "key": "date_created",
                "label": navigator.mozL10n.get("created-on"),
                "type": "date"
            },
            {
                "key": "date_updated",
                "label": navigator.mozL10n.get("modified-on"),
                "type": "date"
            }
        ];
    };
    
    this.getUserNotes = function() {
        user.getNotebooks(function(notebooks) {
            if (notebooks.length == 0) {
                self.newNotebook(TEXTS.FIRST_NOTEBOOK_NAME, function(notebook, note){
                    NotebooksList.refresh(notebooks);
                });
            } else {
                self.showNotes(notebooks[0]);
                NotebooksList.refresh(notebooks);
            }
        });
    };
    
    this.newNotebook = function(name, cb) {
        user.newNotebook({
            "name": name
        }, function(notebook) {
            NotebookView.show(notebook);
            
            self.newNote(notebook, function(note){
                cb && cb(notebook, note);
            });
        });
    };

    this.newNote = function newNote(notebook, cb) {
        if (!notebook) {
            notebook = NotebookView.getCurrent();
        }
        
        if (!notebook) {
            return false;
        }
        
        notebook.newNote({
            "notebookId": notebook.getId()
        }, function onSuccess(note){
            self.editNote(note, notebook);
            
            NoteForm.focus();
            
            cb && cb(note);
        });
        
        return true;
    };

    this.getNotes = function() {
        return notes;
    };
    
    this.showNote = function showNote(note, notebook) {
        if (typeof note === "string") {
            DB.getNotes({"id": note}, function(notes) {
                self.showNote(notes[0], notebook);
            });
        } else {
            NoteView.show(note, notebook);
            cards.goTo(cards.CARDS.NOTE);
        }
    };
    
    this.editNote = function editNote(note, notebook, editFlag) {
        if (typeof editFlag === "undefined") {
            editFlag = false;
        }
        if (typeof note === "string") {
            DB.getNotes({"id": note}, function(notes) {
                self.editNote(notes[0], notebook, editFlag);
            });
        } else {
            NoteForm.show(note, notebook, editFlag);
            cards.goTo(cards.CARDS.NOTE_FORM, "popup");
        }
    };
    
    this.showNotes = function(notebook) {
        NotebookView.show(notebook);
        cards.home();
        
        if (NotebookView.getCurrent()) {
            elButtonNewNote.style.display = "";
        }
    };

    this.promptNewNotebook = function() {
        var notebookName = prompt(TEXTS.NEW_NOTEBOOK, "");
        if (notebookName) {
            self.newNotebook(notebookName);
        }
    };
    
    this.sortNotes = function(sort, isDesc) {
        NotebookView.showNotes(sort, isDesc);
    };
    
    this.showAllNotes = function() {
        NotebookView.show(null, {"trashed": false});
        
        elButtonNewNote.style.display = "none";
        NotebookView.setTitle(TEXTS.NOTEBOOK_ALL);
        
        cards.home();
    };
    
    this.showTrashedNotes = function() {
        NotebookView.show(null, {"trashed": true});
        
        elButtonNewNote.style.display = "none";
        NotebookView.setTitle(TEXTS.NOTEBOOK_TRASH);
        
        cards.home();
    };
    
    //Show option menu
    
    this.prompt = function (opt) {
        function complete() {};

        var number = opt.number || '';
        var email = opt.email || '';
        var header = opt.header || number || email || '';
        var items = [];
        var params, props;

        // Create a params object.
        // - complete: callback to be invoked when a
        // button in the menu is pressed
        // - header: string or node to display in the
        // in the header of the option menu
        // - items: array of options to display in menu
        //
        params = {
            classes: ['contact-prompt'],
            complete: complete,
            header: header,
            items: null
        };

        // All non-email activations will see a "Call" option
        if (email) {
            items.push({
                l10nId: 'sendEmail',
                method: function oEmail(param) {
                  ActivityPicker.email(param);
                },
                params: [email]
            });
        } else {
          items.push({
            l10nId: 'call',
            method: function oCall(param) {
              ActivityPicker.dial(param);
            },
            params: [number]
          });
        }

        params.items = items;

        props = [
            number ? {tel: number} : {email: email}
        ];
        
        params.items.push({
                l10nId: 'createNewContact',
                method: function oCreate(param) {
                    ActivityPicker.createNewContact(param);
                },
                params: props
            },
            {
                l10nId: 'addToExistingContact',
                method: function oAdd(param) {
                    ActivityPicker.addToExistingContact(param);
                },
                params: props
            }
        );

        // All activations will see a "Cancel" option
        params.items.push({
          l10nId: 'cancel',
          incomplete: true
        });

        var options = new OptionMenu(params);
        options.show();
    };
    
    function onCardMove() {
        Notification.hide();
    }
    
    function onNotebookClick(type, notebook) {
        switch(type) {
            case "notebook":
                self.showNotes(notebook);
                break;
            case "all":
                self.showAllNotes();
                break;
            case "trash":
                self.showTrashedNotes();
                break;
        }
    }
    
    function onNotebookRename(notebook) {
        var newName = prompt(TEXTS.PROMPT_RENAME_NOTEBOOK, notebook.getName() || "");
        if (newName) {
            notebook.set({
                "name": newName
            }, function onSuccess() {
                NotebooksList.refresh();
                NotebookView.show(notebook);
            });
        }
    }
    
    function onNotebookDelete(notebook) {
        if (confirm(TEXTS.PROMPT_DELETE_NOTEBOOK)) {
            notebook.trash(function onSuccess() {
                NotebooksList.refresh();
            });
        }
    }
    
    function onNoteEdit(note, notebook) {
        self.editNote(note, notebook, true);
    }
    
    function onNoteSave(noteAffected, editFlag) {
        NotebookView.show(null);
        if (NotebookView.getCurrent()) {
            elButtonNewNote.style.display = "";
        }
        NotebooksList.refresh();
        if (editFlag) {
            NoteView.show(noteAffected);
        }
        cards.back();
    }
    
    function onNoteCancel(noteAffected, isChanged) {
        if (isChanged && confirm(TEXTS.NOTE_CANCEL_CHANGES)) {
            NoteForm.save();
            return;
        }
        
        if (noteAffected.getName() == "" && noteAffected.getContent() == "") {
            noteAffected.remove(function onSuccess(){
                self.showNotes();
                NotebooksList.refresh(); 
            }, function onError() {
                
            });
        } else {
            cards.back();
        }
    }
    
    function onNoteRestore(noteAffected) {
        self.showTrashedNotes();
        NotebooksList.refresh();
        
        noteAffected.getNotebook(function onSuccess(notebook){
            var txt = TEXTS.NOTE_RESTORED.replace("{{notebook}}", notebook.getName());
            Notification.show(txt);
        }, function onError() {
            
        });
    }
    
    function onNoteDelete(noteAffected) {
        self.showTrashedNotes();
        NotebooksList.refresh();
    }
    
    function onNoteChangeNotebook(newNotebookId) {
        var note = NoteInfoView.getCurrent();
        
        note.getNotebook(function(notebook) {
            notebook.set({
                "numberOfNotes": notebook.getNumberOfNotes()-1
            });
        });
        
        note.set({
            "notebook_id": newNotebookId
        }, function onSuccess() {
            note.getNotebook(function(notebook) {
                notebook.set({
                    "numberOfNotes": notebook.getNumberOfNotes()+1
                });
                
                NotebooksList.refresh();
                NoteInfoView.selectNotebook(newNotebookId);
                NotebookView.show(notebook);
            });
        }, function onError() {
            
        });
    }
    
    function onResourceClick(resource) {
        ResourceView.show(resource);
    }
    
    function onResourceDelete(resource) {
        resource.remove(function onSuccess() {
            NoteView.loadResources();
            ResourceView.hide();
        });
    }
    
    function getNoteNameFromContent(content) {
        return (content || "").split("\n")[0];
    }
    
    var NotebooksList = new function() {
        var self = this,
            el = null, elList = null,
            onClick = null, onRefresh = null, onRename = null, onDelete = null,
            
            TIMEOUT_BEFORE_EDITING_NOTEBOOK = 400;
            
        this.init = function(options) {
            !options && (options = {});
            
            el = options.container;
            elList = el.querySelector("ul");
            
            onClick = options.onClick;
            onRefresh = options.onRefresh;
            onRename = options.onRename;
            onDelete = options.onDelete;
        };
        
        this.refresh = function(notebooks) {
            if (!notebooks) {
                user.getNotebooks(self.refresh);
                return;
            }
            
            var numberOfTrashedNotes = 0;
            
            elList.innerHTML = "";
            
            createNotebookEntry_All();
            for (var i=0; i<notebooks.length; i++) {
                numberOfTrashedNotes += notebooks[i].getNumberOfTrashedNotes();
                
                if (!notebooks[i].getTrashed()) {
                    createNotebookEntry(notebooks[i]);
                }
            }
            createNotebookEntry_Trash(numberOfTrashedNotes);
            
            onRefresh && onRefresh(notebooks);
        };
        
        function createNotebookEntry(notebook) {
            var el = document.createElement("li"),
                numberOfApps = notebook.getNumberOfNotes();
                
            el.innerHTML = notebook.getName() + (numberOfApps? " (" + numberOfApps + ")" : "");
            el.addEventListener("touchstart", function(){
                this.timeoutHold = window.setTimeout(function(){
                    el.edited = true;
                    onEditNotebook(notebook);
                }, TIMEOUT_BEFORE_EDITING_NOTEBOOK);
            });
            el.addEventListener("touchend", function(){
                window.clearTimeout(this.timeoutHold);
                if (!this.edited) {
                    clickNotebook(notebook);
                }
                this.edited = false;
            });
            
            elList.appendChild(el);
        }
        
        function createNotebookEntry_All() {
            var el = document.createElement("li");
            el.innerHTML = TEXTS.NOTEBOOK_ALL;
            el.dataset.l10nId = "notebook-all";
            el.className = "all";
            el.addEventListener("click", clickAll);
            
            elList.appendChild(el);
        }
        
        function createNotebookEntry_Trash(numberOfTrashedNotes) {
            var el = document.createElement("li"),
                span = document.createElement("span"),
                text = document.createTextNode((numberOfTrashedNotes ? " (" + numberOfTrashedNotes + ")" : ""));
            
            span.innerHTML = TEXTS.NOTEBOOK_TRASH;
            span.dataset.l10nId = "notebook-trash";
            el.appendChild(span);
            el.appendChild(text);
            el.className = "trash";
            el.addEventListener("click", clickTrash);
            
            elList.appendChild(el);
        }
        
        function onEditNotebook(notebook) {
            dialog(TEXTS.NOTEBOOK_ACTION_TITLE, [TEXTS.NOTEBOOK_ACTION_RENAME, TEXTS.NOTEBOOK_ACTION_DELETE], function(optionClicked) {
                if (optionClicked == 0) {
                    onRename && onRename(notebook);
                } else if (optionClicked == 1) {
                    onDelete && onDelete(notebook);
                }
            });
        }
        
        function clickNotebook(notebook) {
            onClick && onClick("notebook", notebook);
        }
        function clickAll(e) {
            onClick && onClick("all");
        }
        function clickTrash(e) {
            onClick && onClick("trash");
        }
    };
    
    //TODO: code cleanup
    
    var NoteView = new function() {
        var self = this,
            currentNote = null, currentNotebook = null,
            noteContent = "", noteName = "",
            el = null, elContent = null, elResources = null, elTitle = null, elActions = null,
            elRestore = null, elDelete = null, elEdit = null,
            onEdit = null, onRestore = null, onDelete = null,
            resourceView = null,
            
            CLASS_EDIT_TITLE = "edit-title",
            CLASS_WHEN_VISIBLE = "visible",
            CLASS_WHEN_TRASHED = "readonly",
            CLASS_WHEN_HAS_IMAGES = "has-images";
            
        this.init = function(options) {
            el = options.container;
            elEdit = options.elEdit;
            
            onEdit = options.onEdit;
            onRestore = options.onRestore;
            onDelete = options.onDelete;
            
            elContent = el.querySelector("#note-content");
            elResources = el.querySelector(".note-resources");
            elTitle = el.querySelector("h1");
            elActions = el.querySelector("#note-edit-actions");
            elRestore = el.querySelector("#button-note-restore");
            elDelete = el.querySelector("#button-note-delete");
            
            elEdit.addEventListener("click", self.edit);
            
            elRestore.addEventListener("click", self.restore);
            elDelete.addEventListener("click", self.del);
            
            //action menu
            elContent.addEventListener ('click', function (event) {
                LinkActionHandler.onClick(event);
            });
            
            NoteActions.init({
                "el": elActions,
                "onBeforeAction": onBeforeAction,
                "onAfterAction": onAfterAction,
                "label": options.NoteActionsPhotoLabel
            });
            
            resourceView = new ResourceView();
            resourceView.init({
                "container": el.querySelector(".image-fullscreen"),
                "onDelete": onResourceDelete
            });
        };
        
        this.show = function(note, notebook) {
            noteContent = note.getContent();
            noteName = note.getName();
            
            var text = Template.escape(noteContent);
            text = LinkHelper.searchAndLinkClickableData(text);
            
            elContent.innerHTML = text;
            self.setTitle(noteName);
            self.loadResources(note);
            
            if (note.isTrashed()) {
                el.classList.add(CLASS_WHEN_TRASHED);
            } else {
                el.classList.remove(CLASS_WHEN_TRASHED);
            }
            
            currentNote = note;
            currentNotebook = notebook;
        };
        
        this.loadResources = function(note) {
            !note && (note = currentNote);
            
            elResources.innerHTML = '';
            
            note.getResources(function onSuccess(resources) {
                for (var i=0; i<resources.length; i++) {
                    self.addResource(resources[i]);
                }
            }, function onError() {
                
            });
        };
        
        this.addResource = function(resource) {
            elResources.appendChild(getResourceElement(resource));
        };
        
        this.getCurrentNote = function() { return currentNote; };
        this.getCurrentNotebook = function() { return currentNotebook; };
        
        this.setTitle = function(title) {
            html(elTitle, title || getNoteNameFromContent(noteContent) || TEXTS.NEW_NOTE);
        };
        
        this.edit = function() {
            onEdit && onEdit(currentNote, currentNotebook);
        };
        
        this.restore = function() {
            currentNote.restore(function onSuccess(){
                onRestore && onRestore(currentNote);
            }, function onError() {
                
            });
        };
        
        this.del = function() {
            console.log("delete note");
            if (confirm(TEXTS.CONFIRM_DELETE_NOTE)) {
                currentNote.remove(function onSuccess(){
                    onDelete && onDelete(currentNote);
                }, function onError() {
                    
                });
            }
        };
        
        this.focus = function() {
            elContent.focus();
            self.scrollToElement(NUMBER_OF_SCROLL_RETRIES);
        };
        
        this.scrollToElement = function(numberOfTries) {
            var top = elContent.getBoundingClientRect().top;
            
            window.scrollTo(0, top);
            if (numberOfTries > 0 && document.body.scrollTop < top) {
                window.setTimeout(function(){
                    self.scrollToElement(numberOfTries-1);
                }, 80);
            }
        };
        
        function setHeightAccordingToScreen() {
            var tries = 30,
                initialHeight = window.innerHeight,
                intervalHeight = window.setInterval(function(){
                
                if (window.innerHeight < initialHeight) {
                    elContent.style.height = elContent.style.minHeight = (window.innerHeight-elTitle.offsetHeight-elActions.offsetHeight) + "px";
                    window.scrollTo(0, 1);
                }
                
                if (tries == 0 || window.innerHeight < initialHeight) {
                    window.clearInterval(intervalHeight);
                }
                tries--;
            }, 100);
        }
        
        function resetHeight() {
            elContent.style.height = elContent.style.minHeight = "";
        }
        
        function getResourceElement(resource) {
            var el = document.createElement("li"),
                size = resource.getSize();
                
            el.className = resource.getType();
            el.innerHTML = '<span style="background-image: url(' + resource.getSrc() + ')"></span> ' +
                            (resource.getName() || "").replace(/</g, '&lt;') + (size? ' (' + readableFilesize(size) + ')' : '');
                            
                            
            el.addEventListener("click", function(){
                onResourceClick(resource);
            });
            
            return el;
        }
        
        function onResourceClick(resource) {
            resourceView.show(resource);
        }
        
        function onResourceDelete(resource) {
            resource.remove(function onSuccess() {
                self.loadResources();
                resourceView.hide();
            });
        }
        
        function onBeforeAction(action) {
            switch(action) {
                case "info":
                    NoteInfoView.load(currentNote);
                    cards.goTo(cards.CARDS.NOTE_INFO);
                    break;
                case "share":
                    break;
            }
        }
        
        function onAfterAction(action, output) {
            switch(action) {
                case "info":
                    break;
                case "share":
                    break;
                case "delete":
                    if (output) {
                        App.showNotes();
                        NotebooksList.refresh();
                    }
                    break;
            }
        }
    };

    // TODO: fix height issue

    var NoteForm = new function() {
        var self = this,
            currentNote = null, currentNotebook = null,
            noteContentBeforeEdit = "", noteNameBeforeEdit = "",
            el = null, elContent = null, elResources = null, elSave = null, elCancel = null, elTitle = null, elEditTitle = null,
            onSave = null, onCancel = null, onTitleChange = null, editMode = false,
            resourceView = null,

            CLASS_EDIT_TITLE = "edit-title",
            CLASS_WHEN_VISIBLE = "visible",
            CLASS_WHEN_HAS_IMAGES = "has-images";

        this.init = function(options) {
            el = options.container;
            elSave = options.elSave;
            elCancel = options.elCancel;

            onSave = options.onSave;
            onCancel = options.onCancel;
            onTitleChange = options.onTitleChange;
            //onResourceClick = options.onResourceClick;

            elContent = el.querySelector("textarea");
            elResources = el.querySelector(".note-resources");
            elTitle = el.querySelector("h1");
            elEditTitle = el.querySelector("input");
            elAttachment = el.querySelector("#note-form-attachment");

            elTitle.addEventListener("click", self.editTitle);
            elEditTitle.addEventListener("blur", self.saveEditTitle);
            elEditTitle.addEventListener("keyup", function(e){
                (e.keyCode == 13) && self.saveEditTitle();
            });

            elContent.addEventListener("focus", onContentFocus);
            elContent.addEventListener("blur", onContentBlur);
            elContent.addEventListener("keyup", onContentKeyUp);

            elSave.addEventListener("click", self.save);
            elCancel.addEventListener("click", self.cancel);
            elAttachment.addEventListener("click", addAttachment);
            
            resourceView = new ResourceView();
            resourceView.init({
                "container": el.querySelector(".image-fullscreen"),
                "onDelete": onResourceDelete
            });
        };

        this.show = function(note, notebook, editFlag) {
            var noteContent = note.getContent(),
                noteName = note.getName();

            editMode = editFlag;
            if (editMode) {
                el.classList.add("skin-organic");
            } else {
                el.classList.remove("skin-organic");
            }
            noteContentBeforeEdit = noteContent;
            noteNameBeforeEdit = noteName;

            elContent.value = noteContent;
            self.setTitle(noteName);
            self.loadResources(note);

            onContentKeyUp();
            onContentBlur();

            currentNote = note;
            currentNotebook = notebook;
        };
        
        this.loadResources = function(note) {
            !note && (note = currentNote);
            
            elResources.innerHTML = '';
            
            note.getResources(function onSuccess(resources) {
                for (var i=0; i<resources.length; i++) {
                    self.addResource(resources[i]);
                }
            }, function onError() {
                
            });
        };
        
        this.addResource = function(resource) {
            elResources.appendChild(getResourceElement(resource));
        };
        
        function getResourceElement(resource) {
            var el = document.createElement("li"),
                size = resource.getSize();
                
            el.className = resource.getType();
            el.innerHTML = '<span style="background-image: url(' + resource.getSrc() + ')"></span> ' +
                            (resource.getName() || "").replace(/</g, '&lt;') + (size? ' (' + readableFilesize(size) + ')' : '');
                            
                            
            el.addEventListener("click", function(){
                onResourceClick(resource);
            });
            
            return el;
        }
        
        function onResourceClick(resource) {
            resourceView.show(resource);
        }
        
        function onResourceDelete(resource) {
            resource.remove(function onSuccess() {
                self.loadResources();
                resourceView.hide();
            });
        }
        
        function addAttachment() {
            if ("MozActivity" in window) {
                var act = new MozActivity({
                    'name': 'pick',
                    'data': {
                        'type': 'image/*',
                        'width': 320,
                        'height': 480
                    }
                });
                
                act.onsuccess = function() {
                    if (!act.result.blob) return;
                    
                    // convert the blob to an image (base64)
                    var reader = new FileReader();
                    reader.readAsDataURL(act.result.blob);
                    reader.onload = function onBlobRead(e) {
                        var output = {
                            "name": TEXTS.PHOTO_LABEL,
                            "src": reader.result,
                            "size": e.total || 0,
                            "type": ResourceTypes.IMAGE
                        };
                        currentNote.newResource(output, function onSuccess(resource) {
                            self.addResource(resource);
                            el.classList.add(CLASS_WHEN_HAS_IMAGES);
                        }, function onError() {
                            
                        });
                    };
                };
            } else {
                alert(TEXTS.IMAGE_NOT_SUPPORTED);
            }
        }

        this.getCurrentNote = function() { return currentNote; };
        this.getCurrentNotebook = function() { return currentNotebook; };

        this.setTitle = function(title) {
            html(elTitle, title || getNoteNameFromContent(elContent.value) || TEXTS.NEW_NOTE);
            elEditTitle.value = title || "";
        };

        this.editTitle = function() {
            if (!currentNote || currentNote.isTrashed()) return;

            el.classList.add(CLASS_EDIT_TITLE);
            elEditTitle.focus();
        };

        this.saveEditTitle = function() {
            el.classList.remove(CLASS_EDIT_TITLE);
            elEditTitle.blur();

            self.setTitle(elEditTitle.value);

            onTitleChange && onTitleChange();
        };

        this.save = function() {
            var content = elContent.value,
                name = elEditTitle.value;

            currentNote.set({
                "title": name,
                "text": content
            }, function onSuccess(){
                Console.error("Save successfully");
                onSave && onSave(currentNote, editMode);
            }, function onError(){
                Console.error("Error saving note!");
            });
        };

        this.cancel = function() {
            onCancel && onCancel(currentNote, self.changed());
        };

        this.focus = function() {
            elContent.focus();
            self.scrollToElement(NUMBER_OF_SCROLL_RETRIES);
        };

        this.scrollToElement = function(numberOfTries) {
            var top = elContent.getBoundingClientRect().top;

            window.scrollTo(0, top);
            if (numberOfTries > 0 && document.body.scrollTop < top) {
                window.setTimeout(function(){
                    self.scrollToElement(numberOfTries-1);
                }, 80);
            }
        };

        this.changed = function() {
            return noteContentBeforeEdit !== elContent.value || noteNameBeforeEdit !== elEditTitle.value;
        };

        function onContentKeyUp(e) {
            if (elContent.value) {
                elSave.classList.add(CLASS_WHEN_VISIBLE);
                !elEditTitle.value && (html(elTitle, getNoteNameFromContent(elContent.value)));
            } else {
                elSave.classList.remove(CLASS_WHEN_VISIBLE);
                self.setTitle();
            }
        }

        function onContentFocus(e) {
            el.classList.remove(EMPTY_CONTENT_CLASS);

            window.scrollTo(0, 1);

            setHeightAccordingToScreen();
        }

        function onContentBlur(e) {
            if (elContent.value) {
                el.classList.remove(EMPTY_CONTENT_CLASS);
            } else {
                el.classList.add(EMPTY_CONTENT_CLASS);
            }

            //resetHeight();
        }

        function setHeightAccordingToScreen() {
            var tries = 30,
                initialHeight = window.innerHeight,
                intervalHeight = window.setInterval(function(){

                    if (window.innerHeight < initialHeight) {
                        elContent.style.height = elContent.style.minHeight = (window.innerHeight-elTitle.offsetHeight) + "px";
                        window.scrollTo(0, 1);
                    }

                    if (tries == 0 || window.innerHeight < initialHeight) {
                        window.clearInterval(intervalHeight);
                    }
                    tries--;
                }, 100);
        }

        function resetHeight() {
            elContent.style.height = elContent.style.minHeight = "";
        }
    };
    
    var NoteInfoView = new function() {
        var self = this,
            el = null, fields = [], currentNote = null,
            onNotebookChange = null;
            
        this.init = function(options) {
            el = options.container;
            fields = options.fields;
            onNotebookChange = options.onNotebookChange;
            
            elFields = el.querySelector(".fields");
            
            initView();
        };
        
        this.load = function(note) {
            if (currentNote && note.getId() === currentNote.getId()) {
                return;
            }
            
            for (var i=0,f; f=fields[i++];) {
                var value = note['data_' + f.key],
                    elValue = elFields.querySelector("." + f.key);
                    
                switch(f.type) {
                    case "date":
                        value = printDate(value);
                        html(elValue, value);
                        break;
                    case "options":
                        elValue.value = value;
                        break;
                }
            }
            
            currentNote = note;
        };
        
        this.getCurrent = function() {
            return currentNote;
        };
        
        this.refreshNotebooks = function(notebooks) {
            var html = '',
                elSelect = elFields.querySelector(".notebook_id"),
                currentValue = elSelect.value;
                
            for (var i=0,notebook; notebook=notebooks[i++];) {
                html += '<option value="' + notebook.getId() + '">' + notebook.getName() + '</option>';
            }
            elSelect.innerHTML = html;
            
            elSelect.value = currentValue;
        };
        
        this.selectNotebook = function(notebookId) {
            elFields.querySelector(".notebook_id").value = notebookId;
        };
        
        this.onChange_notebook_id = function(e) {
            onNotebookChange && onNotebookChange(this.value);
        };
        
        function initView() {
            var html = '';
            
            for (var i=0,f; f=fields[i++];) {
                var type = f.type;
            
                html += '<li>' +
                            '<label>' + f.label + '</label>' +
                            ((type === "options")?
                            '<select class="' + f.key + '"></select>' :
                            '<b class="value ' + f.key + '"></b>') +
                        '</li>';
            }
            
            elFields.innerHTML += html;
            
            // automatically bind onChange events to all fields of type "option"
            for (var i=0,f; f=fields[i++];) {
                if (f.type === "options") {
                    elFields.querySelector("select." + f.key).addEventListener("change", self["onChange_" + f.key]);
                }
            }
        }
        
        function printDate(date) {
            if (typeof date == "number") {
                date = new Date(date);
            }
            
            var formatted = "",
                h = date.getHours(),
                m = date.getMinutes();
                
            formatted += (h<10? '0' : '') + h + ":" + (m<10? '0' : '') + m;
            formatted += " ";
            formatted += date.getDate() + "/" + (date.getMonth()+1) + "/" + date.getFullYear();
            
            return formatted;
        }
    };
    
    var NotebookView = new function() {
        var self = this,
            el = null, elTitle = null, elEditTitle = null, elSearchTitle = null, elEmptyNotes = null, $notesList = null,
            currentNotebook = null, currentFilters = null, currentSort = "", currentIsDesc = false,
            onClickNote = null, notebookScrollOffset = 0,
            onChange = null;
        
        this.init = function(options) {
            el = options.container;
            onClickNote = options.onClickNote;
            onChange = options.onChange;
            
            elTitle = el.querySelector("h1");
            elEditTitle = el.querySelector("input");
            elEmptyNotes = el.querySelector(".empty p");

            elSearchTitle = el.querySelector("h2");
            
            elTitle.addEventListener("click", self.editTitle);
            elEditTitle.addEventListener("blur", self.saveEditTitle);
            elEditTitle.addEventListener("keyup", function(e){
                (e.keyCode == 13) && self.saveEditTitle();
            });
            
            $notesList = el.getElementsByClassName("notebook-notes")[0];
            
            $notesList.addEventListener("click", clickNote);
            
            notebookScrollOffset = $("search").offsetHeight;
        };
        
        this.show = function(notebook, filters, bDontScroll) {
            if (filters) {
                notebook = null;
                currentNotebook = null;
            } else if(!notebook) {
                if (currentFilters) {
                    filters = currentFilters;
                    notebook = null;
                } else {
                    filters = null;
                    notebook = currentNotebook;
                }
            }
            
            el.classList.remove("notebook-real");
            el.classList.remove("notebook-fake");
            el.classList.add(notebook || !filters.trashed ? "notebook-real": "notebook-fake");
            
            notebook && self.setTitle(notebook.getName());
            
            if (!currentNotebook || currentNotebook.getId() != notebook.getId()) {
                currentSort = "";
                currentIsDesc = false;
            }
            
            currentNotebook = notebook;
            currentFilters = filters;
            
            self.showNotes(currentSort, currentIsDesc, filters);
            
            if (!bDontScroll) {
                self.scrollTop();
            }
        };
        
        this.showNotes = function(sortby, isDesc, filters) {
            currentSort = sortby;
            currentIsDesc = isDesc;
            if (filters === undefined) {
                filters = currentFilters;
            }
            
            if (currentNotebook) {
                if (currentNotebook.getNumberOfNotes() == 0) {
                    self.printNotes([]);
                } else {
                    currentNotebook.getNotes(false, function(notes){
                        self.printNotes(notes);
                    }, function onError() {
                        
                    });
                }
            } else {
                user.getNotes(filters, function onSuccess(notes){
                    self.printNotes(notes, filters.trashed);
                }, function onError() {
                    
                });
            }
        };
        
        this.printNotes = function(notes, trashed) {
            //console.log('trashed: '+trashed);
            $notesList.innerHTML = '';
            
            notes = sortNotes(notes, currentSort, currentIsDesc);
            
            if (notes && notes.length > 0) {
                for (var i=0; i<notes.length; i++) {
                    $notesList.appendChild(getNoteElement(notes[i]));
                }
                el.classList.remove(EMPTY_CONTENT_CLASS);
            } else {
                el.classList.add(EMPTY_CONTENT_CLASS);
                elEmptyNotes.innerHTML = currentNotebook || !trashed ? TEXTS.EMPTY_NOTEBOOK : TEXTS.EMPTY_TRASH;
                elEmptyNotes.dataset.l10nId = currentNotebook || !trashed ? "empty-notebook" : "empty-trash";
            }
            
            return $notesList;
        };
        
        this.setTitle = function(title) {
            html(elTitle, title || TEXTS.EMPTY_NOTEBOOK_NAME);
            elEditTitle.value = title || "";
        };
        
        this.editTitle = function() {
            if (!currentNotebook) return;
            
            el.classList.add(CLASS_EDIT_TITLE);
            elEditTitle.focus();
        };
        
        this.saveEditTitle = function() {
            if (!currentNotebook) return;
            
            el.classList.remove(CLASS_EDIT_TITLE);
            elEditTitle.blur();
            
            var newName = elEditTitle.value;
            if (newName != currentNotebook.getName()) {
                currentNotebook.set({
                    "name": newName
                }, function cbSuccess() {
                    self.setTitle(newName);
                    onChange && onChange();
                }, function cbError() {
                    
                });
            }
        };

        this.getCurrent = function() {
            return currentNotebook;
        };
        
        this.scrollTop = function(scrollTop) {
            $notesList.parentNode.scrollTop = (typeof scrollTop == "number")? scrollTop : notebookScrollOffset;
        };

        this.showSearchTitle = function() {
            elTitle.style.display = "none";
            elSearchTitle.style.display = "block";
        };

        this.hideSearchTitle = function() {
            elTitle.style.display = "block";
            elSearchTitle.style.display = "none";
        };
        
        function getNoteElement(note) {
            var el = document.createElement("li");
            el.className = "note";
            el.dataset.noteId = note.getId();
            el.innerHTML = '<div><span class="text">' + (note.getName() || getNoteNameFromContent(note.getContent())).replace(/</g, '&lt;') + '</span> <span class="time">' + prettyDate(note.getDateUpdated()) + '</span></div>' +
                            '<div class="title">' + note.getContent().replace(/</g, '&lt;') + '</div>';/* +
                            (note.getImages().length > 0? '<div class="image" style="background-image: url(' + note.getImages()[0].src + ')"></div>' : '');*/
            
            if (note.isTrashed()) {
                el.className += " trashed";
            }
            
            return el;
        }
        
        function sortNotes(notes, sortby, isDesc) {
            if (!sortby) return notes;
            
            notes.sort(function(a, b){
                var valA = a['data_' + sortby] || (sortby == "title" && a['data_text']) || '',
                    valB = b['data_' + sortby] || (sortby == "title" && b['data_text']) || '';
                
                return valA > valB? (isDesc?-1:1)*1 : valA < valB? (isDesc?1:-1)*1 : 0;
            });
            
            return notes;
        }
        
        // the click is captured on the entire list,
        // and we extract the specific note from the event target
        function clickNote(e) {
            var elNote = e.target;
            while (elNote && elNote.tagName != "LI") {
                elNote = elNote.parentNode;
            }
            
            if (elNote) {
                onClickNote && onClickNote(elNote.dataset.noteId, currentNotebook);
            } else if (TIME_FOR_NEW_NOTE_DOUBLECLICK) {
                if (currentNotebook && (createNoteOnTap || el.classList.contains(EMPTY_CONTENT_CLASS))) {
                    App.newNote(currentNotebook);
                } else {
                    createNoteOnTap = true;
                    window.setTimeout(function(){
                        createNoteOnTap = false;
                    }, TIME_FOR_NEW_NOTE_DOUBLECLICK);
                }
            }
        }
    };
    
    function ResourceView() {
        var self = this,
            el = null, elImage = null, elName = null,
            currentResource = null, onDelete = null;
            
        var CLASS_WHEN_VISIBLE = "visible";
            
        this.init = function(options) {
            el = options.container;
            onDelete = options.onDelete;
            
            elImage = el.querySelector(".image");
            elName = el.querySelector(".name");
            
            el.querySelector(".button-resource-close").addEventListener("click", self.hide);
            el.querySelector(".button-resource-delete").addEventListener("click", self.del);
        };
        
        this.show = function(resource) {
            elImage.style.backgroundImage = 'url(' + resource.getSrc() + ')';
            html(elName, resource.getName());
            
            el.classList.add(CLASS_WHEN_VISIBLE);
            
            currentResource = resource;
        };
        
        this.hide = function() {
            el.classList.remove(CLASS_WHEN_VISIBLE);
        };
        
        this.del = function() {
            currentResource && onDelete && onDelete(currentResource);
        };
    };
    
    var NoteActions = new function() {
        var self = this,
            el = null,
            onBeforeAction = null, onAfterAction = null, photoLabel = null;
            
        this.init = function(options) {
            el = options.el;
            onBeforeAction = options.onBeforeAction;
            onAfterAction = options.onAfterAction;
            
            elInfo = el.querySelector(".info");
            elShare = el.querySelector(".share");
            elDelete = el.querySelector(".delete");
            
            elInfo.addEventListener("click", actionInfo);
            elShare.addEventListener("click", actionShare);
            elDelete.addEventListener("click", actionDelete);

            photoLabel = options.label;
        };
        
        function actionType() {
            onBeforeAction && onBeforeAction("type");
            
            onAfterAction && onAfterAction("type");
        }
        
        function actionPhoto() {
            onBeforeAction && onBeforeAction("photo");
            
            if ("MozActivity" in window) {
                var act = new MozActivity({
                    'name': 'pick',
                    'data': {
                        'type': 'image/jpeg',
                        'width': 320,
                        'height': 480
                    }
                });
                
                act.onsuccess = function() {
                    if (!act.result.blob) return;
                    
                    // convert the blob to an image (base64)
                    var reader = new FileReader();
                    reader.readAsDataURL(act.result.blob);
                    reader.onload = function onBlobRead(e) {
                        onAfterAction && onAfterAction("photo", {
                            "name": photoLabel,
                            "src": reader.result,
                            "size": 0
                        });
                    };
                };
            } else {
                alert(TEXTS.IMAGE_NOT_SUPPORTED);
            }
        }
        
        function actionInfo() {
            onBeforeAction && onBeforeAction("info");
            
            onAfterAction && onAfterAction("info");
        }
        
        function actionShare() {
            onBeforeAction && onBeforeAction("share");
            
            
            var act = new MozActivity({
                'name': 'new',
                'data': {
                    'type': 'mail',
                    'URI': "mailto:?subject=My+Note&body=" + encodeURIComponent($("note-content").innerHTML)
                }
            });
            act.onsuccess = function(e){ };
            act.onerror = function(e){ };
            
            
            onAfterAction && onAfterAction("share");
        }
        
        function actionDelete() {
            onBeforeAction && onBeforeAction("delete");
            
            if (confirm(TEXTS.CONFIRM_TRASH_NOTE)) {
                NoteView.getCurrentNote().trash(function onSuccess() {
                    onAfterAction && onAfterAction("delete", true);
                }, function onError() {
                    
                });
            } else {
                onAfterAction && onAfterAction("delete", false);
            }
        }
    };
    
    var Notification = new function() {
        var self = this,
            el = null, timeoutHide = null;
            
        var CLASS_WHEN_VISIBLE = "visible",
            TIME_TO_SHOW = 4000;
            
        this.init = function(options) {
            el = document.createElement("div");
            el.className = "notifier";
            
            options.container.appendChild(el);
        };
        
        this.show = function(message) {
            if (!el) return;
            
            window.clearTimeout(timeoutHide);
            
            el.innerHTML = message;
            el.classList.add(CLASS_WHEN_VISIBLE);
            
            timeoutHide = window.setTimeout(self.hide, TIME_TO_SHOW);
        };
        
        this.hide = function() {
            if (!el) return;
            
            window.clearTimeout(timeoutHide);
            el.classList.remove(CLASS_WHEN_VISIBLE);
        };
    }
    
    var SearchHandler = new function() {
        var notebookBeforeSearch = null;
        
        this.open = function() {
            NotebookView.scrollTop(0);
            Searcher.focus();
        };
        
        this.onSearch = function(items, keyword, fields) {
            NotebookView.showSearchTitle();
            if (items.length > 0) {
                var elList = NotebookView.printNotes(items);
                
                window.setTimeout(function(){
                    markOccurences(elList, keyword, fields);
                }, 0);
            } else {
                if (!keyword) {
                    NotebookView.hideSearchTitle();
                    showPreviousNotebook(true);
                } else {
                    NotebookView.printNotes([]);
                }
            }
        };
        
        this.onFocus = function(e) {
            document.body.classList.add(CLASS_SEARCH_RESULTS);
            
            var _currentNotebook = NotebookView.getCurrent();
            if (_currentNotebook) {
                notebookBeforeSearch = _currentNotebook;
            }
            
            user.getNotes({}, function onSuccess(notes){
                Searcher.setData(notes);
            }, function onError() {
                
            });
        };
        
        this.onBlur = function(e) {
            document.body.classList.remove(CLASS_SEARCH_RESULTS);
            if (!Searcher.value()) {
                showPreviousNotebook(true);
            }
        };
        
        function showPreviousNotebook(hideSearch) {
            NotebookView.show(notebookBeforeSearch, null, hideSearch);
        }
        
        function markOccurences(elList, keyword, fields) {
            var els = elList.childNodes,
                regex = new RegExp("(" + keyword + ")", "ig");
                
            for (var i=0,l=els.length; i<l; i++) {
                for (var j=0; j<fields.length; j++) {
                    var el = els[i].getElementsByClassName(fields[j]);
                    if (el && el.length > 0) {
                        el = el[0];
                        el.innerHTML = el.innerHTML.replace(regex, '<b>$1</b>');
                    }
                }
            }
        }
    }

    var Sorter = new function() {
        var self = this,
            el = null, elOptionNotebook = null,
            currentOrder = "", currentDesc = false, onChange = null;
            
        this.ORDER = {};
        
        this.init = function(options) {
            this.ORDER = options.orders;
            onChange = options.onChange;
            createElement(options.container);
        };
        
        this.show = function() {
            el.focus();
        };
        
        /* these don't work on B2G, since they create a new element of their own.
         * the created element should take the visibility from the actual options
         */
        this.showSortByNotebook = function() {
            elOptionNotebook.style.display = "block";
        };
        this.hideSortByNotebook = function() {
            elOptionNotebook.style.display = "none";
        };
        
        function createElement(parent) {
            if (el) return;
            
            el = document.createElement("select");
            
            el.addEventListener("change", el.blur);
            el.addEventListener("blur", select);
            
            var html = '';
            for (var i=0,order; order=self.ORDER[i++];) {
                var option = document.createElement("option");
                    
                option.value = order.property;
                option.innerHTML = order.label;
                option.setAttribute("data-descending", order.descending);
                
                if (option.value == "notebook_id") {
                    elOptionNotebook = option;
                }
                
                el.appendChild(option);
            }
            
            self.hideSortByNotebook();
            
            parent.appendChild(el);
        }
        
        function select() {
            var options = el.childNodes,
                sortby = "",
                isDescending = false;
                
            for (var i=0,option; option=options[i++];) {
                if (option.selected) {
                    sortby = option.value;
                    isDescending = option.getAttribute("data-descending") === "true";
                    break;
                }
            }
            
            if (currentOrder != sortby) {
                currentOrder = sortby;
                currentDesc = isDescending;
                onChange && onChange(currentOrder, currentDesc);
            }
        }
    };
};

function readableFilesize(size) {
    var sizes = ["kb", "mb", "gb", "tb"];
    
    for (var i=0; i<sizes.length; i++) {
        size = Math.round(size/1000);
        if (size < 1000) {
            return size + sizes[i];
        }
    }
}

function prettyDate(time) {
  switch (time.constructor) {
    case String:
      time = parseInt(time);
      break;
    case Date:
      time = time.getTime();
      break;
  }
  
  var diff = (Date.now() - time) / 1000;
  var day_diff = Math.floor(diff / 86400);
  
  if (isNaN(day_diff)) {
    return '(incorrect date)';
  }
  
  return day_diff == 0 && (
    diff < 60 && navigator.mozL10n.get("just-now") ||
    diff < 120 && navigator.mozL10n.get("1-minute-ago") ||
    diff < 3600 && navigator.mozL10n.get("minutes-ago", { "t": Math.floor(diff / 60) }) ||
    diff < 7200 && navigator.mozL10n.get("1-hour-ago") ||
    diff < 86400 && navigator.mozL10n.get("hours-ago", { "t": Math.floor(diff / 3600) })) ||
    day_diff == 1 && navigator.mozL10n.get("yesterday") ||
    day_diff < 7 && navigator.mozL10n.get("days-ago", { "t": day_diff }) ||
    day_diff < 9 && navigator.mozL10n.get("a-week-ago") ||
    formatDate(new Date(time));
}

function formatDate(date) {
    return date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear();
}

function $(s) { return document.getElementById(s); }
function html(el, s) { el.innerHTML = (s || "").replace(/</g, '&lt;'); }

window.onload = function onLoad() {
    navigator.mozL10n.ready(App.init);
}
