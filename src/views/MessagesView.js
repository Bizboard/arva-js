/**
 * Created by mysim1 on 26/03/15.
 */
import Surface                      from 'famous/core/Surface';
import Scrollview                   from 'famous/views/Scrollview';
import ObjectHelper                 from '../utils/objectHelper';
import {ChatMessages}               from '../models/ChatMessages';


export class MessagesView extends Scrollview {
    constructor() {
        super();

        /* Bind all local methods to the current object instance, so we can refer to 'this'
         * in the methods as expected, even when they're called from event handlers.        */
        ObjectHelper.bindAllMethods(this, this);

        /* Hide all private properties (starting with '_') and methods from enumeration,
         * so when you do for( in ), only actual data properties show up. */
        ObjectHelper.hideMethodsAndPrivatePropertiesFromObject(this);

        /* Hide the priority field from enumeration, so we don't save it to the dataSource. */
        ObjectHelper.hidePropertyFromObject(Object.getPrototypeOf(this), 'length');

        // have this scrollView initialize itself
        this._initializeList();

        // make sure the data is provisioned.
        this._populateMessages();

    }

    _initializeList() {

        this.surfaces = [];
        this.sequenceFrom(this.surfaces);

        let firstOne = new Surface({
            content: 'Loading content...',
            size: [undefined, 50],
            properties: {
                backgroundColor: 'hsl(' + ((30) * 360 / 40) + ', 100%, 50%)',
                lineHeight: '50px',
                textAlign: 'center'
            }
        });

        firstOne.pipe(this);
        this.surfaces.push(firstOne);

        for (let i = 0, temp; i < 40; i++) {
            temp = new Surface({
                //content: 'Surface: ' + (i + 1),
                size: [undefined, 0],
                properties: {
                    backgroundColor: 'hsl(' + ((i % 2 === 0 ? 15 : 30) * 360 / 40) + ', 100%, 50%)',
                    lineHeight: '50px',
                    textAlign: 'center'
                }
            });

            temp.pipe(this);
            this.surfaces.push(temp);
        }
    }

    _populateMessages() {
        let scrollView = this;

        window.messages = new ChatMessages();

        window.messages.setValueChangedCallback(function (list) {

            for (let i = 0; i < scrollView.surfaces.length; i++) {
                scrollView.surfaces[i].size = [undefined, 0];
                scrollView.surfaces[i].setContent('');
            }

            for (let i = 0; i < list.length; i++) {
                scrollView.surfaces[i].size = [undefined, 50];
                scrollView.surfaces[i].setContent(list[i].Title);
            }
        });
    }
}
