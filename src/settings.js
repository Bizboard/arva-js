/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */


import {annotate, Provide}          from 'di.js';
import {DataSource}                 from 'arva-ds/core/DataSource';
import {FirebaseDataSource} from 'arva-ds/datasources/FirebaseDataSource';

export function DefaultDataSource() {
    return new FirebaseDataSource("https://<yourapp>.firebaseio.com");
}

annotate(DefaultDataSource, new Provide(DataSource));
