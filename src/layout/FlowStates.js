/**


 @author: Manuel Overdijk
 @license NPOSL-3.0
 @copyright Bizboard, 2016

 */

import Easing               from 'famous/transitions/Easing.js';

import {layout, flow}               from './Decorators.js';

export const flowStates = {
    defaultTransition: {curve: Easing.outCubic, duration: 500},

    fade: function(stateName = '', options = {opacity: 0}, stateOptions = {transition: flowStates.defaultTransition, delay: 0}) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, layout.opacity(options.opacity))(target, renderableName, descriptor);
        }
    },
    fadeLeft: function(stateName = '', options = {translation: -300, opacity: 0}, stateOptions = {transition: flowStates.defaultTransition, delay: 0}) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, layout.translateFrom(options.translation, 0, 0), layout.opacity(options.opacity))(target, renderableName, descriptor);
        }
    },
    fadeRight: function(stateName = '', options = {translation: 300, opacity: 0}, stateOptions = {transition: flowStates.defaultTransition, delay: 0}) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, layout.translateFrom(options.translation, 0, 0), layout.opacity(options.opacity))(target, renderableName, descriptor);
        }
    },
    fadeTop: function(stateName = '', options = {translation: -300, opacity: 0}, stateOptions = {transition: flowStates.defaultTransition, delay: 0}) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, layout.translateFrom(0, options.translation, 0), layout.opacity(options.opacity))(target, renderableName, descriptor);
        }
    },
    fadeBottom: function(stateName = '', options = {translation: 300, opacity: 0}, stateOptions = {transition: flowStates.defaultTransition, delay: 0}) {
        return function (target, renderableName, descriptor) {
            flow.stateStep(stateName, stateOptions, layout.translateFrom(0, options.translation, 0), layout.opacity(options.opacity))(target, renderableName, descriptor);
        }
    }
};