/**

 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import Timer                            from 'famous/utilities/Timer.js';
import {ObjectHelper}                   from './ObjectHelper.js';

export class Throttler {
    /**
     *
     * @param {Number} throttleDelay Minimum amount of time in between each action executed by the Throttler, in milliseconds or ticks.
     * @param {Boolean} shouldQueue Enable if each added action should be executed consecutively, or disable if a newly
     * added action should replace a previous one.
     * @param {Object} actionContext Context to which the actions executed by the Throttler will be bound.
     * @param {Boolean} useTicks whether ticks should be used instead of milliseconds
     * @returns {Throttler} Throttler instance.
     */
    constructor(throttleDelay = 0, shouldQueue = true, actionContext = this, useTicks = false) {
        this.delay = throttleDelay;
        this._useTicks = useTicks;
        this._timerFunction = useTicks ? Timer.every : Timer.setInterval;
        this.timer = null;
        this.shouldQueue = shouldQueue;
        this.actionContext = actionContext;

        this.queue = [];
        this.executionTimer = null;

    }

    /**
     * Adds an executable action to the queue that will be executed consecutively by the Throttler.
     * If Throttler was constructed with shouldQueue = false, adding a new action will remove the old one.
     * @param {Function} action Function to execute.
     * @returns {void}
     */
    add(action) {
        if(this.delay === 0){
            action.call(this.actionContext);
        } else {
            /* If we're not queueing, clear the previous action if present. The new action will replace the old one. */
            if (!this.shouldQueue) {
                this.queue.pop();
            }

            this.queue.push(action);
            this._setTimer();
        }

    }

    async _setTimer() {
        if (!this.timer) {
            this.timer = this._timerFunction(this._executeTopAction.bind(this), this.delay);
        }
    }

    /**
     * Clears the Throttler's timer if it is set.
     * @returns {void}
     * @private
     */
    _clearTimer() {
        Timer.clear(this.timer);
        this.timer = null;
    }

    async _awaitPromise() {
        if(this.waitFor && this.waitFor instanceof Promise) {
            await this.waitFor;
            this.waitFor = null;
        }
    }

    /**
     * Removes the top action from the Throttler's queue if any is present, and executes it with the correct binding context.
     * @returns {void}
     * @private
     */
    async _executeTopAction() {
        if(this.waitFor && this.waitFor instanceof Promise) {
            return;
        }

        let action = this.queue.shift();
        if (action && typeof action === 'function') {
            let result = action.call(this.actionContext);
            this.waitFor = result instanceof Promise ? result : null;
        }

        if (!this.queue.length) {
            this._clearTimer();
        } else {
            this._clearTimer();
            await this._awaitPromise();
            this._setTimer();
        }
    }
}