/**
 * Created by mysim1 on 23/03/15.
 */

import Engine               from 'famous/core/Engine';
import Surface              from 'famous/core/Surface';
import {Controller}         from '../core/Controller';
import {MessagesView}        from '../views/MessagesView';

export default class HomeController extends Controller {

    constructor(router, context) {
        super(router, context);

        this.messagesView = new MessagesView();
    }

    ReRouteExample() {
        this.router.go(this, "Index", ['a','b']);
    }

    Index() {
        return this.messagesView;
    }
}

