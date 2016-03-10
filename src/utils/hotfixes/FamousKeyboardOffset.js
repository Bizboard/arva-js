/**
 Fixes a bug causing the entire viewport to stick when a keyboard is spawned by a user click on an input field.
 When the keyboard is hidden again, the viewport remains in the top of the screen, with the bottom part of the screen being blank.

 This is caused by a change in Famo.us 0.3.0, and has been marked as "won't fix": https://github.com/Famous/famous/issues/317

 This Source Code is licensed under the MIT license. If a copy of the
 MIT-license was not distributed with this file, You can obtain one at:
 http://opensource.org/licenses/mit-license.html.

 @author: Tom Clement (tjclement)
 @license MIT
 @copyright Bizboard, 2015

 */

import './famouskeyboardoffset.css!';
