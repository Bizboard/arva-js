/**
 * Created by lundfall on 12/07/2017.
 */

import FamousInputSurface from 'famous/surfaces/InputSurface.js';
import {onOptionChange} from '../utils/view/OptionObserver.js'
import {
    InputOption,
    getValue,
    changeValue
} from '../utils/view/InputOption.js'
import {combineOptions} from 'arva-js/utils/CombineOptions.js';

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
     *   This extends the Surface class.
     *
     * @class InputSurface
     * @extends Surface
     * @constructor
     * @param {Object} [options] overrides of default options
     * @param {string} [options.placeholder] placeholder text hint that describes the expected value of an <input> element
     * @param {string} [options.type] specifies the type of element to display (e.g. 'datetime', 'text', 'button', etc.)
     * @param {string} [options.value] value of text
     */
    constructor(options = {}) {

        super({
            ...options,
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
        let newValue = options.value;
        /* If the value is an instance of an InputOption, then we need to prepare for upward data-flow */
        if (newValue instanceof InputOption) {
            if ((!options[onOptionChange] || !options[onOptionChange].value)) {
                let optionChangeListener = options[onOptionChange];
                if (!optionChangeListener) {
                    optionChangeListener = options[onOptionChange] = {};
                }
                optionChangeListener.value = (changedValue) => newValue[changeValue](changedValue);
            }
            options.value = newValue[getValue]();
        }
        return super.with({...options, properties: {...neutralAppearanceProperties, ...options.properties}})
    }

    setValue(value, emitEvent = false) {

        if (this.options.isFormField) {
            this._setBorderBottomColor(value);
        }
        let result = super.setValue(...arguments);
        if (emitEvent) {
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
        if (currentValue !== this._value) {
            this._onNewValue(currentValue);
        }
    }

    _onNewValue(currentValue) {
        if (this.options.emojiEnabled) {
            currentValue = replaceEmojiAtEnd(currentValue);
            this.setValue(currentValue);
        }


        this._value = currentValue;
        if (this.options.isFormField) {
            this._setBorderBottomColor(currentValue);
        }
        this.emit('valueChange', currentValue);

        let optionChangeListeners = this.options[onOptionChange];
        if (optionChangeListeners && optionChangeListeners.value) {
            optionChangeListeners.value(currentValue);
        }
    }
}
