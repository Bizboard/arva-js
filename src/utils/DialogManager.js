/**
 * Created by lundfall on 06/07/16.
 */
import Timer                 from 'famous/utilities/Timer';
import AnimationController   from 'famous-flex/AnimationController';
import Surface               from 'famous/core/Surface';
import FamousContext         from 'famous/core/Context.js';

import {View}                from 'arva-js/core/View.js';
import {ObjectHelper}        from 'arva-js/utils/ObjectHelper';

import {Context}             from './Context.js';
import {Router}              from '../core/Router.js';
import {layout}              from '../layout/decorators.js';

@layout.scrollable
class DialogWrapper extends View {
    @layout.size((size) => Math.min(480, size - 32), true)
    @layout.place('center')
    dialog = this.options.dialog;

    onNewParentSize(parentSize) {
        this._parentSize = parentSize;
    }

    getSize() {
        if(!this._parentSize){
            return [undefined, undefined];
        }
        let dialogHeight = this.dialog.getSize()[1];
        return this._parentSize[1] > dialogHeight ? [undefined, undefined] : [undefined, dialogHeight];
    }

}

export class DialogManager extends View {

    @layout.fullscreen
    @layout.animate({showInitially: false, animation: AnimationController.Animation.Fade})
    @layout.translate(0, 0, 250)
    background = new Surface({
        properties: {
            /* Permalink - use to edit and share this gradient: http://colorzilla.com/gradient-editor/#000000+0,000000+100&0.2+0,0.6+100 */
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%,rgba(0,0,0,0.6) 100%)', /* W3C, IE10+, FF16+, Chrome26+, Opera12+, Safari7+ */
            filter: "progid:DXImageTransform.Microsoft.gradient( startColorstr='#33000000', endColorstr='#99000000',GradientType=1 )" /* IE6-9 fallback on horizontal gradient */
        }
    });

    @layout.translate(0, 0, 1000)
    @layout.fullscreen
    @layout.animate({
        animation: AnimationController.Animation.Slide.Up,
        showInitially: false
    })
    /* Empty content until filled */
    dialog = {};


    constructor(options = {}) {
        super(options);
        /* For ionic-plugin-keyboard */
        if (window.Keyboard) {
            /* Prevent keyboard from showing */
            window.addEventListener('native.keyboardshow', () => {
                /* Hides the keyboard when a dialog is  shown */
                if (this._hasOpenDialog) {
                    Keyboard.hide();
                }
            });
        }
        this.router = Context.get(Router);
        let famousContext = Context.get(FamousContext);
        famousContext.add(this);

        this.layout.on('layoutstart', ({size}) => {
            if(this.dialog.onNewParentSize){
                this.dialog.onNewParentSize(size);
                this._savedParentSize = null;
            }   else {
                this._savedParentSize = size;
            }
        });


        document.addEventListener("backbutton", this._onClose);
        this.renderables.background.on('click', this._onClose);
    }

    /**
     *
     * @param dialog
     * @param processingDialog
     * @param isExplanation used for exaplanation texts
     */
    show({dialog, canCancel = true, killOldDialog = true}) {
        if (this._hasOpenDialog) {
            /* If already open dialog we should either close that one, or just keep the current one, depending on the settings */
            if (!killOldDialog) {
                return;
            }
            this.close();
        }
        this._hasOpenDialog = true;

        /* Replace whatever non-showing dialog we have right now with the new dialog */
        this.replaceRenderable('dialog', new DialogWrapper({dialog}));
        if(this._savedParentSize){
            this.dialog.onNewParentSize(this._savedParentSize);
        }

        this._canCancel = canCancel;
        if (canCancel) {
            /* Disable existing default behavior of backbutton going back to previous route */
            this.initialBackButtonState = this.router.isBackButtonEnabled();
            this.router.setBackButtonEnabled(false);
        }

        /* Show the dialog */
        this.showRenderable('dialog');

        this.dialog.on('closeDialog', (function () {
            /* Forward the arguments coming from the event emitter when closing */
            this.close(...arguments)
        }).bind(this));

        /* Showing the background immediately propagates user's click event that triggered the show() directly to the background,
         * closing the dialog again. Delaying showing the background circumvents this issue. */
        Timer.setTimeout(() => {
            if (this._hasOpenDialog) {
                this.showRenderable('background');
            }
        }, 10);
        return this.dialogComplete();
    }


    _onClose() {
        if (this._canCancel) {
            this.close();
        }
    }

    hasOpenDialog() {
        return this._hasOpenDialog;
    }


    dialogComplete() {
        if(!this._resolveDialogComplete){
            return this._resolveDialogPromise = new Promise((resolve) => {
                this._resolveDialogComplete = resolve
            });
        } else {
            return this._resolveDialogPromise;
        }

    }

    close() {
        if (this._hasOpenDialog) {

            /* Restore back button state */
            if (this._canCancel) {
                this.router.setBackButtonEnabled(this.initialBackButtonState);
            }
            /* Resolve promise if necessary */
            if (this._resolveDialogComplete) {
                this._resolveDialogComplete(arguments);
                this._resolveDialogComplete = null;
            }
            this._hasOpenDialog = false;

            this.hideRenderable('dialog');
            this.hideRenderable('background');
            this._eventOutput.emit('close', ...arguments);
        }
    }
}
