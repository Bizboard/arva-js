/**
 * Created by mysim1 on 26/03/15.
 */
import Engine                       from 'famous/core/Engine';
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import ObjectHelper                 from '../utils/objectHelper';
import LayoutController             from 'famous-flex/src/LayoutController';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';


const DEFAULT_OPTIONS = {
    margin: 10
};

export class NewChupsView extends View {



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
            infopanel: new BkImageSurface({
                content: 'img/sf0.jpg',
                sizeMode: 'cover'
            }),
            topleft: new BkImageSurface({
                content: 'img/sf1.jpg',
                sizeMode: 'cover',
                properties: {
                    id: 1
                }
            }),
            topright: new BkImageSurface({
                content: 'img/sf2.jpg',
                sizeMode: 'cover',
                properties: {
                    id: 2
                }
            }),
            bottomleft: new BkImageSurface({
                content: 'img/sf3.jpg',
                sizeMode: 'cover',
                properties: {
                    id: 3
                }
            }),
            bottomright: new BkImageSurface({
                content: 'img/sf4.jpg',
                sizeMode: 'cover',
                properties: {
                    id: 4
                }
            })
        };
        var self = this;

        this._renderables.topleft.on('click', function() {
            var id = this.properties.id;
            self._eventOutput.emit('play', id);
        });

        this._renderables.topright.on('click', function() {
            var id = this.properties.id;
            self._eventOutput.emit('play', id);
        });

        this._renderables.bottomleft.on('click', function() {
            var id = this.properties.id;
            self._eventOutput.emit('play', id);
        });

        this._renderables.bottomright.on('click', function() {
            var id = this.properties.id;
            self._eventOutput.emit('play', id);
        });
    }

    _createLayout() {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function(context, options) {

                var infoPanelSize = [
                    context.size[0],
                    context.size[1]*0.2];

                var centre = context.size[0]/2;
                var imgSize = [centre-(this.options.margin*2),centre-(this.options.margin*2)];


                context.set('infopanel', {
                    size: infoPanelSize
                });


                context.set('topleft', {
                    size: imgSize,
                    translate: [this.options.margin*2, (context.size[1]*0.2)+this.options.margin, 1]
                });

                context.set('topright', {
                    size: imgSize,
                    translate: [centre, (context.size[1]*0.2)+this.options.margin, 1]
                });

                context.set('bottomleft', {
                    size: imgSize,
                    translate: [this.options.margin*2, (context.size[1]*0.2)+centre, 1]
                });

                context.set('bottomright', {
                    size: imgSize,
                    translate: [centre, (context.size[1]*0.2)+centre, 1]
                });


            }.bind(this),
            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }
}