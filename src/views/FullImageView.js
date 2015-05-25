/**
 * Created by mysim1 on 26/03/15.
 */
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import LayoutController             from 'famous-flex/src/LayoutController';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';

import {ObjectHelper}               from '../utils/objectHelper';


const DEFAULT_OPTIONS = {
    classes: ['view', 'fullImage'],
    margins: [20, 20, 20, 20],
    textHeight: 30,
    branding: {
        textColor: 'red'
    }
};



export class FullImageView extends View {

    constructor() {

        //let OPTIONS = DEFAULT_OPTIONS;
        //OPTIONS.branding = _.extend(OPTIONS.branding, BrandingEngine.getInstance().getAll());
        //
        super(DEFAULT_OPTIONS);

        /* Bind all local methods to the current object instance, so we can refer to 'this'
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');

        this._createRenderables();
        this._createLayout();

    }

    _createRenderables() {
        this._renderables = {
            background: new Surface({
                classes: this.options.classes.concat(['background'])
            }),
            image: new BkImageSurface({
                classes: this.options.classes.concat(['image']),
                content: 'img/scarlett.jpg',
                sizeMode: 'cover',
                color: this.options.textColor
            }),
            text: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.text
            })
        };
    }

    _createLayout() {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function(context) {
                context.set('background', {
                    size: context.size
                });
                var imageSize = [
                    context.size[0] - this.options.margins[1] - this.options.margins[3],
                    context.size[1] - this.options.margins[0] - this.options.margins[2]
                ];
                if (imageSize[0] > imageSize[1]) {
                    imageSize[0] = imageSize[1];
                } else {
                    imageSize[1] = imageSize[0];
                }
                context.set('image', {
                    size: imageSize,
                    translate: [(context.size[0] - imageSize[0]) / 2, (context.size[1] - imageSize[1]) / 2, 1]
                });
                context.set('text', {
                    size: [context.size[0], this.options.textHeight],
                    translate: [0, context.size[1] - this.options.textHeight, 1]
                });
            }.bind(this),
            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }
}