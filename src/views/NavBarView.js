/**
 * Created by mysim1 on 26/03/15.
 */
import Engine                       from 'famous/core/Engine';
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import ObjectHelper                 from '../utils/objectHelper';
import LayoutController             from 'famous-flex/src/LayoutController';
import LayoutDockHelper             from 'famous-flex/src/helpers/LayoutDockHelper';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';

const DEFAULT_OPTIONS = {
        classes: ['view', 'profile'],
        navBar: {
            height: 50,
            left: false
        },
        profileText: 'Scarlett Johansson was born in New York City. Her mother, Melanie Sloan, is from an Ashkenazi Jewish family, and her father, Karsten Johansson, is Danish. Scarlett showed a passion for acting at a young age and starred in many plays.<br><br>She has a sister named Vanessa Johansson, a brother named Adrian, and a twin brother named Hunter Johansson born three minutes after her. She began her acting career starring as Laura Nelson in the comedy film North (1994).<br><br>The acclaimed drama film The Horse Whisperer (1998) brought Johansson critical praise and worldwide recognition. Following the film\'s success, she starred in many other films including the critically acclaimed cult film Ghost World (2001) and then the hit Lost in Translation (2003) with Bill Murray in which she again stunned critics. Later on, she appeared in the drama film Girl with a Pearl Earring (2003).'
}

export class NavBarView extends View {

    constructor() {
        super(DEFAULT_OPTIONS);

        /* Bind all local methods to the current object instance, so we can refer to "this"
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
            navBarBackground: new Surface({
                classes: this.options.classes.concat(['navbar', 'background'])
            }),
            navBarTitle: new Surface({
                classes: this.options.classes.concat(['navbar', 'title']),
                content: '<div>' + 'Scarlett Johansson' + '</div>'
            }),
            navBarImage: new BkImageSurface({
                classes: this.options.classes.concat(['navbar', 'image']),
                content: 'img/scarlett.jpg',
                sizeMode: 'cover'
            }),
            content: new Surface({
                classes: this.options.classes.concat(['text']),
                content: this.options.profileText
            })
        };
    }


    _createLayout() {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function(context, options) {
                var dock = new LayoutDockHelper(context, options);
                dock.fill('background');
                dock.top('navBarBackground', this.options.navBar.height, 1);
                context.set('navBarTitle', {
                    size: [context.size[0], this.options.navBar.height],
                    translate: [0, 0, 2]
                });
                context.set('navBarImage', {
                    size: [32, 32],
                    translate: [this.options.left ? 20 : (context.size[0] - 20 - 32), 9, 2]
                });
                dock.top(undefined, 20);
                dock.fill('content', 1);
            }.bind(this),
            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }
}