/**
 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Hans van den Akker (mysim1)
 @license MIT
 @copyright Bizboard, 2015

 */


import {Provide}                    from 'di.js';
import {DataSource}                 from 'arva-ds/core/DataSource';
import {FirebaseDataSource}         from 'arva-ds/datasources/FirebaseDataSource';

@Provide(DataSource)
export function DefaultDataSource() {
    return new FirebaseDataSource('https://es6test.firebaseio.com');
}
