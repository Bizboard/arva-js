/**
 * Created by lundfall on 12/07/2017.
 */

import FamousInputSurface   from 'famous/surfaces/InputSurface.js';
import {onOptionChange}     from '../utils/view/OptionObserver.js'
import {combineOptions}     from 'arva-js/utils/CombineOptions.js';

let neutralAppearanceProperties = {
    outline: 'none',
    borderBottom: 'none',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    padding: '0 16px 0 16px'
};

export class InputSurface extends FamousInputSurface {
    static tabIndex = 1;

    /**
     * An InputSurface that will produce a HTML <input> tag, or similar
     * @param options
     */
    constructor(options = {}) {

        super({...options,
            attributes: {
                ...options.attributes,
                tabIndex: InputSurface.tabIndex++
            }
        });
        this.on('paste', this._onFieldChange);
        this.on('input', this._onFieldChange);
        this.on('propertychange', this._onFieldChange);
        this.on('change', this._onFieldChange);
    }

    static with(options) {
        return super.with({...options, properties: {...neutralAppearanceProperties, ...options.properties}})
    }

    setValue(value, emitEvent = false) {

        if (this.options.isFormField) {
            this._setBorderBottomColor(value);
        }
        let result =  super.setValue(...arguments);
        if(emitEvent){
            this._onNewValue(value);
        }
        return result;
    }

    focus() {
        super.focus();
        this.emit('focus');
    }

    blur() {
        super.blur();
        this.emit('blur');
    }

    _setBorderBottomColor(textInput) {
        this.setProperties({borderBottom: `1px solid ${!textInput.length ? 'gray' : 'black'}`})

    }

    // TODO We should emit a change event instead, and prevent the parent change event. valueChange event is only emitted by SOME input components.
    _onFieldChange() {
        let currentValue = this.getValue();
        if (currentValue != this._value) {
            this._onNewValue(currentValue);
        }
    }

    _onNewValue(currentValue) {
        if(this.options.emojiEnabled) {
            currentValue = replaceEmojiAtEnd(currentValue);
            this.setValue(currentValue);
        }


        this._value = currentValue;
        if (this.options.isFormField) {
            this._setBorderBottomColor(currentValue);
        }
        this.emit('valueChange', currentValue);

        let optionChangeListeners = this.options[onOptionChange];
        if(optionChangeListeners && optionChangeListeners.value){
            optionChangeListeners.value(currentValue);
        }
    }
}
