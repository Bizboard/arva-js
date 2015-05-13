/**
 * Created by mysim1 on 26/03/15.
 */
import Engine                       from 'famous/core/Engine';
import Surface                      from 'famous/core/Surface';
import View                         from 'famous/core/View';
import ObjectHelper                 from '../utils/objectHelper';
import LayoutController             from 'famous-flex/src/LayoutController';
import BkImageSurface               from 'famous-bkimagesurface/BkImageSurface';
import FlexScrollView               from 'famous-flex/src/FlexScrollView';
import Utility                      from 'famous/utilities/Utility';

const DEFAULT_OPTIONS = {
    margin: 10
};

export class ChupPlayView extends View {



    constructor(options) {
        super(DEFAULT_OPTIONS);
        this.id = options;
        /* Bind all local methods to the current object instance, so we can refer to "this"
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');

        this._createRenderables(this.id);
        this._createLayout(this.id);
        this._createEventHandlers();

    }

    _createRenderables(options) {


        var scrollView = new FlexScrollView({
            autoPipeEvents: true,
            mouseMove: true
        });

        scrollView.push(new Surface({
            properties: {
                'background-color':'white',
                'border-radius':'4px',
                '-webkit-box-shadow': '0px 4px 4px 0px rgba(50, 50, 50, 0.34)',
                'padding':'10px',
                'line-height':'1.4'

            },
            content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in tellus in lectus congue feugiat. Suspendisse vitae accumsan risus, a congue quam. Integer eget lacinia ligula. Sed consectetur tellus consequat ex aliquet, vel commodo arcu rhoncus. Nam laoreet, ligula non pharetra vehicula, urna lorem auctor odio, ut vehicula lacus metus vel eros. Praesent vitae fermentum nibh. Morbi nec ornare dui, sit amet viverra massa. Nullam imperdiet mattis ex, non volutpat sem. Phasellus sit amet varius nunc. Aenean consectetur ac ipsum auctor lacinia. Vestibulum aliquam congue porttitor. Pellentesque at nisl auctor, eleifend enim id, blandit augue. Nunc ornare ut ex quis semper. Aliquam blandit, diam nec commodo malesuada, nulla enim maximus sapien, sit amet gravida leo massa quis magna. Cras pretium neque vel mi dignissim, non blandit leo lobortis. Integer tincidunt posuere nisi. Praesent nisi ipsum, blandit vitae maximus ut, rutrum vitae odio. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in tellus in lectus congue feugiat. Sit amet, consectetur adipiscing elit. Donec in tellus in lectus congue feugiat. '
        }));

        scrollView.push(new Surface({
            size:[undefined,200],
            content: ''
        }));


        this._renderables = {
            infopanel: scrollView,
            background: new Surface({
                properties: {
                    'background-color':'#e6e6e6'
                }
            }),
            next: new BkImageSurface({
                size: [32,32],
                content: 'img/next.png'
            })
        }

        this._renderables['chupheader' + this.id] = new BkImageSurface({
                content: 'img/sf' + this.id + '.jpg',
                sizeMode: 'cover'
            });



    }

    _createLayout(id) {
        this.layout = new LayoutController({
            autoPipeEvents: true,
            layout: function(context, options) {

                var infoPanelSize = [
                    context.size[0],
                    context.size[1]*0.2];

                context.set('background', {
                    size: [context.size[0],context.size[1]],
                    translate: [0,0,-2]
                });

                context.set('chupheader' + this.id, {
                    size: infoPanelSize,
                    translate: [0,0,1]
                });

                context.set('infopanel', {
                    size: [context.size[0]-this.options.margin*2, undefined],
                    translate: [this.options.margin,(context.size[1]*0.2)+this.options.margin,0]
                });

                context.set('next', {
                    origin: [0.5, 0.5],
                    align: [0.9,0.1],
                    translate: [0,0,2]
                });

            }.bind(this),
            dataSource: this._renderables
        });
        this.add(this.layout);
        this.layout.pipe(this._eventOutput);
    }

    _createEventHandlers() {
        var view = this;

        this._renderables['chupheader' + this.id].on('click', function() {
            view._eventOutput.emit('home');
        });

        this._renderables.next.on('click', function() {
            view._eventOutput.emit('play', parseInt(view.id)+1);
        });


    }
}