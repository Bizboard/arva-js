/**
 @author: Tom Clement (tjclement)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

export function limit(min, value, max) {
    return Math.min(Math.max(min, value), max);
}