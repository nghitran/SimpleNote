/**
 * Created by supertux on 1/24/14.
 */

var Cards = function(_options) {
    var _this = this,
        onMove = null,
        _currentView = null,
        stack = [];

    var transitions = {
        'right-left': 'card-right',
        'popup': 'card-bottom'
    };

    var CLASS_WHEN_ACTIVE = "active";

    this.CARDS = {};

    this.init = function(options) {
        !options && (options = {});

        onMove = options.onMove;
        initCards();
    }

    this.goTo = function(index, transitionEffect) {
        transitionEffect = typeof transitionEffect !== 'undefined' ? transitionEffect : 'right-left';

        stack = stack.filter(function(item) {
            return item.view != index;
        });

        var next = document.getElementById(index);
        next.classList.remove(transitions[transitionEffect] || transitionEffect);
        var zIndexValue = stack.length > 0 ? stack[stack.length-1].zIndex + 1 : 1;
        stack.push({ view: index, transition: transitionEffect, zIndex: zIndexValue});
        next.style.zIndex = zIndexValue;
        _currentView = index;
    }

    this.back = function back() {
        if (stack.length < 2) {
            return;
        }

        var currentView = stack.pop();
        var current = document.getElementById(currentView.view);
        var nextView = stack[stack.length - 1];
        var transition = currentView.transition;
        current.classList.add(transitions[transition] || transition);
        _currentView = nextView.view;
    };

    this.currentView = function currentView() {
        return _currentView != null ? _currentView : '';
    };

    function initCards() {
        var defaultIndex = "",
            cardElements = document.getElementsByClassName("card");

        for (var i=0, l=cardElements.length; i<l; i++) {
            var el = cardElements[i];

            _this.CARDS[el.id.toUpperCase().replace(/-/g, "_")] = el.id;

            addDefaultButtons(el);

            if (el.className.indexOf(CLASS_WHEN_ACTIVE) !== -1) {
                _currentView = el.id;
                defaultIndex = el.id;
            }
        }

        _this.goTo(defaultIndex);
    }

    function addDefaultButtons(el) {
        var buttons = el.getElementsByClassName("card-prev");
        for (var i=0; i<buttons.length; i++) {
            buttons[i].addEventListener("click", function(){
                _this.back();
            });
        }
    }

    _this.init(_options);
}
