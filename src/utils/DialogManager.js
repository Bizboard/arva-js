/**
 * Created by lundfall on 06/07/16.
 */
import {Surface}             from '../surfaces/Surface.js';
import FamousContext         from 'famous/core/Context.js';
import Timer                 from 'famous/utilities/Timer';
import Easing                from 'famous/transitions/Easing.js';
import AnimationController   from 'famous-flex/AnimationController';

import {Injection}           from './Injection.js';
import {View}                from '../core/View.js';
import {Router}              from '../core/Router.js';
import {layout}              from '../layout/Decorators.js';
import {DialogWrapper}       from './dialog/DialogWrapper.js';


export class DialogManager extends View {

    @layout.fullSize()
    @layout.animate({showInitially: false, animation: AnimationController.Animation.Fade})
    /* Add huge translations to make sure that it appears above everything else */
    @layout.translate(0, 0, 9000)
    background = new Surface({
        properties: {
            backgroundColor: "rgba(0,0,0,0.4)"
        }
    });

    @layout.translate(0, 0, 9500)
    @layout.fullSize()
    @layout.animate({
        show: {transition: {curve: Easing.outCubic, duration: 300}, animation: AnimationController.Animation.Slide.Up},
        hide: {transition: {curve: Easing.inCubic, duration: 300}, animation: AnimationController.Animation.Slide.Down},
        showInitially: false
    })
    /* Empty content until filled */
    dialog = View.empty();

    canCancel = true;

    constructor(options = {}) {
        super(options);
        /* For ionic-plugin-keyboard */
        if (window.Keyboard) {
            /* Prevent keyboard from showing */
            window.addEventListener('native.keyboardshow', () => {
                /* Hides the keyboard when a dialog is  shown */
                if (this.hasOpenDialog()) {
                    Keyboard.hide();
                }
            });
        }
        this.router = Injection.get(Router);
        let famousContext = Injection.get(FamousContext);
        famousContext.add(this);

        this.on('newSize', (size) => {
            if (this.dialog.onNewParentSize) {
                this.dialog.onNewParentSize(size);
                this._savedParentSize = null;
            } else {
                this._savedParentSize = size;
            }
        }, {propagate: false});


        document.addEventListener("backbutton", ()=> this.canCancel && this.close());
        this.background.on('click', ()=> this.canCancel && this.close());
    }

    /**
     *
     * @param {Dialog} options.dialog dialog
     * @param {Boolean} [options.canCancel=true]
     * @param {Boolean} [options.killOldDialog=true]
     * @returns {*}
     */
    show({dialog, canCancel = true, killOldDialog = true, shouldGoToRoute = null}) {
        if(!dialog){
            throw new Error('No dialog specified in show() function of DialogManager');
        }

        this._shouldGoBackInHistory = shouldGoToRoute || this._shouldGoBackInHistory;
        this.canCancel = canCancel;
        if(dialog.canCancel){
            this.canCancel = dialog.canCancel;
        }

        /* If already open dialog we should either close that one, or just keep the current one, depending on the settings */
        if (this.hasOpenDialog()) {
            if(!killOldDialog){
                return this.dialogComplete();
            }
            this._close();
        }

        this._hasOpenDialog = true;

        /* Replace whatever non-showing dialog we have right now with the new dialog */
        this.replaceRenderable(this.dialog, new DialogWrapper({dialog}));
        if (this._savedParentSize) {
            this.dialog.onNewParentSize(this._savedParentSize);
        }

        if (this.canCancel) {
            /* Disable existing default behavior of backbutton going back to previous route */
            this.initialBackButtonState = this.router.isBackButtonEnabled();
            this.router.setBackButtonEnabled(false);
        }

        /* Show the dialog */
        this.showRenderable(this.dialog).then(() => {
            this._eventOutput.emit('dialogShown');
        });

        this.dialog.on('closeDialog', this.close);

        /* Showing the background immediately propagates user's click event that triggered the show() directly to the background,
         * closing the dialog again. Delaying showing the background circumvents this issue. */
        Timer.setTimeout(() => {
            if (this.hasOpenDialog()) {
                this.showRenderable(this.background);
            }
        }, 10);
        return this.dialogComplete();
    }

    /**
     * Handles the logic for closing the dialog and possible going back in History
     * @param {Boolean} [goBackInHistory] Set to false to prevent router.goBackInHistory() from being called after close.
     */
    close(goBackInHistory = false) {
        if (this.hasOpenDialog()) {

            /* Restore back button state */
            if (this.canCancel) {
                this.router.setBackButtonEnabled(this.initialBackButtonState);
            }
            /* Resolve promise if necessary */
            if (this._resolveDialogComplete) {
                this._resolveDialogComplete(arguments);
                this._resolveDialogComplete = null;
            }

            /* Close the current dialog */
            if(goBackInHistory || this._shouldGoBackInHistory){
                this._goBackInHistory();
            } else {
                this._close();
            }
        }
    }

    getOpenDialog() {
        return this.hasOpenDialog() && this.dialog.dialog;
    }

    hasOpenDialog() {
        return this._hasOpenDialog;
    }


    dialogComplete() {
        if (!this._resolveDialogComplete) {
            if(!this.hasOpenDialog()){
                return Promise.resolve();
            }
            return this._resolveDialogPromise = new Promise((resolve) => {
                this._resolveDialogComplete = resolve
            });
        } else {
            return this._resolveDialogPromise;
        }

    }

    /**
     * Closes a dialog
     * @private
     */
    _close(){
        this._hasOpenDialog = false;
        this.hideRenderable(this.dialog);
        this.hideRenderable(this.background);
        this._eventOutput.emit('close', ...arguments);
    }

    /**
     * Let the router go back in history, this will automatically close the current dialog
     * @private
     */
    _goBackInHistory(){
        let route = this._shouldGoBackInHistory;
        this._shouldGoBackInHistory = false;
        (route instanceof Object && route.controller) ? this.router.go(route.controller, route.method, route.params) : this.router.goBackInHistory();

    }
}
