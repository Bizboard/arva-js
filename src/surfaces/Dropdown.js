/**
 * Created by lundfall on 12/07/2017.
 */

/**
 * Created by lundfall on 21/09/16.
 */

import {View}                       from 'arva-js/core/View.js';
import {flow, layout, event}        from 'arva-js/layout/Decorators.js';
import {combineOptions}             from 'arva-js/utils/CombineOptions.js';
import {onOptionChange}             from '../utils/view/OptionObserver.js'

import {Surface}                    from '../surfaces/Surface.js';


export class Dropdown extends Surface {
    elementType = 'select';

    constructor(options){
        super(options);
        this.on('change', () => {
            let optionChangeListeners = this.options[onOptionChange];
            if(optionChangeListeners ){
                let selectedItemIndex = this.options.selectedItemIndex = this._element.selectedIndex;
                let selectedItem = this.options.selectedItem = this.options.items[selectedItemIndex];
                if(optionChangeListeners.selectedItem){
                    optionChangeListeners.selectedItem(selectedItem);
                }
                if(optionChangeListeners.selectedItemIndex){
                    optionChangeListeners.selectedItemIndex(selectedItem);
                }
            }
        })
    }

    deploy (target) {
        this.content = `${this.options.placeholder ? `<option value="" disabled selected hidden>${this.options.placeholder}</option>` : ''}
            ${this.options.items.map((item, index) => `<option value=${item.data} ${
            index === this.options.selectedItemIndex
                ? 'selected' : ''}>${item.text}</option>`)}`;
        return super.deploy(target);
    }

    static with(options) {
        return super.with({
            ...options,
            selectedItem: options.selectedItemIndex ? options.items[selectedItemIndex] : options.items.find((item) => item.selected),
            properties: {
                overflow: 'hidden',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: 'white',
                borderRadius: '4px',
                padding: '0 0 0 16px',
                outline: 'none',
                /* Doesn't work for IE and firefox */
                '-webkit-appearance': 'none',
                ...options.properties
            }
        })
    }

}
