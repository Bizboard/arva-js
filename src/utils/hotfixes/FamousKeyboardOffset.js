/**
 Fixes a bug causing the entire viewport to stick when a keyboard is spawned by a user click on an input field.
 When the keyboard is hidden again, the viewport remains in the top of the screen, with the bottom part of the screen being blank.

 This is caused by a change in Famo.us 0.3.0, and has been marked as "won't fix": https://github.com/Famous/famous/issues/317



 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import './famouskeyboardoffset.css!';
