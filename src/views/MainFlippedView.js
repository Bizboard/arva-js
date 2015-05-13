/**
 * Created by mysim1 on 13/05/15.
 */



import Engine                       from 'famous/core/Engine';
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import ObjectHelper                 from '../utils/objectHelper';
import LayoutController             from 'famous-flex/src/LayoutController';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';
import FlexScrollView               from 'famous-flex/src/FlexScrollView';
import Utility                      from 'famous/utilities/Utility';
import Flipper                      from 'famous/views/Flipper';
import {NewChupsView}               from './NewChupsView';



export class MainFlippedView extends Flipper {



    constructor() {
        super();

        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');


        this.setFront(new NewChupsView());
        this.setBack(new Surface({content : 'back',
            properties : {
                background : 'blue',
                color : 'white',
                lineHeight : '200px',
                textAlign  : 'center'
            }}));
    }
}