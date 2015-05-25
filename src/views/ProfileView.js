/**
 * Created by mysim1 on 26/03/15.
 */
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import LayoutController             from 'famous-flex/src/LayoutController';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';

import {ObjectHelper}               from '../utils/objectHelper';


const DEFAULT_OPTIONS = {
    classes: ['view', 'profile'],
    imageSize: [200, 200],
    imageScale: [1, 1, 1],
    nameHeight: 60,
    profileText: 'Scarlett Johansson was born in New York City. Her mother, Melanie Sloan, is from an Ashkenazi Jewish family, and her father, Karsten Johansson, is Danish. Scarlett showed a passion for acting at a young age and starred in many plays.<br><br>She has a sister named Vanessa Johansson, a brother named Adrian, and a twin brother named Hunter Johansson born three minutes after her. She began her acting career starring as Laura Nelson in the comedy film North (1994).<br><br>The acclaimed drama film The Horse Whisperer (1998) brought Johansson critical praise and worldwide recognition. Following the film\'s success, she starred in many other films including the critically acclaimed cult film Ghost World (2001) and then the hit Lost in Translation (2003) with Bill Murray in which she again stunned critics. Later on, she appeared in the drama film Girl with a Pearl Earring (2003).'
};

export class ProfileView extends View {

    constructor() {
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
                sizeMode: 'cover'
            }),
            name: new Surface({
                classes: this.options.classes.concat(['name']),
                content: '<div>Scarlett Johansson</div>'
            }),
            text: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.profileText
            })
        };
    }

    _createLayout() {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function (context) {
                context.set('background', {
                    size: context.size
                });
                var image = context.set('image', {
                    size: this.options.imageSize,
                    translate: [(context.size[0] - this.options.imageSize[0]) / 2, 20, 1],
                    scale: this.options.imageScale
                });
                var name = context.set('name', {
                    size: [context.size[0], this.options.nameHeight],
                    translate: [0, image.size[1] + image.translate[1], 1]
                });
                context.set('text', {
                    size: [context.size[0], context.size[1] - name.size[1] - name.translate[1]],
                    translate: [0, name.translate[1] + name.size[1], 1]
                });
            }.bind(this),
            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }

    /*
     getTransferable(id) {
     return {
     get: function() {
     // return current renderable that matches the given id
     return this.layout.get(id);
     },
     show: function(renderable) {
     // show given renderable
     this.layout.replace(id, renderable);
     },
     getSpec: function(callback, endState) {
     // when the view knows the size, position, etc... of the requested id,
     // it should call callback and pass along the render spec
     callback(endState);
     }
     };
     };*/
}