/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */

import {DefaultApp}                             from './DefaultApp';
import {DefaultDataSource}                      from './settings';
import {reCreateDefaultContext}                 from './DefaultContext';

// Your main that creates a DI context and uses that context to load your application. We can provide the
// router, but also the datasource provider.

reCreateDefaultContext(DefaultDataSource)
    .get(DefaultApp);


