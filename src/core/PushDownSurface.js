/**
 * Created by lundfall on 18/10/2016.
 */
import Surface      from 'famous/core/Surface.js';

/**
 * Surface with absolute position serving the purpose to push down remainder of content in y-space
 */
export class PushDownSurface extends Surface {
    
    elementClass = '';
    
    allocate(allocator) {
        return allocator.allocate({ type: this.elementType, insertFirst: true });
    }
}