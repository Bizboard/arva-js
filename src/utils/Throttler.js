/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

import {ObjectHelper}                   from './ObjectHelper.js';

export class Throttler {
    /**
     *
     * @param {Number} throttleDelay Minimum amount of time in between each action executed by the Throttler, in milliseconds.
     * @param {Boolean} shouldQueue Enable if each added action should be executed consecutively, or disable if a newly
     * added action should replace a previous one.
     * @param {Object} actionContext Context to which the actions executed by the Throttler will be bound.
     * @returns {Throttler} Throttler instance.
     */
    constructor(throttleDelay = 0, shouldQueue = true, actionContext = this) {
        this.delay = throttleDelay;
        this.shouldQueue = shouldQueue;
        this.actionContext = actionContext;

        this.queue = [];
        this.executionTimer = null;
        this.lastExecuted = Date.now() - throttleDelay;

        ObjectHelper.bindAllMethods(this, this);
    }

    /**
     * Adds an executable action to the queue that will be executed consecutively by the Throttler.
     * If Throttler was constructed with shouldQueue = false, adding a new action will remove the old one.
     * @param {Function} action Function to execute.
     * @returns {void}
     */
    add(action) {
        /* If we're not queueing, clear the previous action if present. The new action will replace the old one. */
        if(!this.shouldQueue) { this.queue.pop(); }

        this.queue.push(action);
        this._checkTimer();
    }

    /**
     * Checks if the time since the last executed action is greater than or equal to the given throttleDelay.
     * If it is, the top action will be executed Throttler's timer reset if there are more actions waiting.
     * @returns {void}
     * @private
     */
    _checkTimer() {
        let timeSinceLastExecuted = Date.now() - this.lastExecuted;

        if(timeSinceLastExecuted >= this.delay) {
            /* It's been at least the given throttleDelay since the last execution, so we can go ahead and execute the top action. */
            this._executeTopAction();
            this.lastExecuted = Date.now();

            /* If we have more actions in the queue, fire up the timer. */
            if(this.queue.length) {
                this._resetTimer();
            }
        } else {
            /* We've not reached the throttleDelay yet, so we'll need to wait at least long enough to reach it. */
            let timeToWait = this.delay - timeSinceLastExecuted;
            this._resetTimer(timeToWait);
        }
    }

    /**
     * Clears the Throttler's timer if it is set, and sets it to the given timeToWait.
     * @param {Number} timeToWait Time to set the timer to, in milliseconds.
     * @returns {void}
     * @private
     */
    _resetTimer(timeToWait = this.delay) {
        clearTimeout(this.executionTimer);
        this.executionTimer = setTimeout(this._checkTimer, timeToWait);

    }

    /**
     * Removes the top action from the Throttler's queue if any is present, and executes it with the correct binding context.
     * @returns {void}
     * @private
     */
    _executeTopAction() {
        let action = this.queue.shift();
        if(action && typeof action === 'function'){
            action.call(this.actionContext);
        }
    }
}