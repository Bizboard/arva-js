/**
 * Created by lundfall on 18/10/2016.
 */
import Surface      from 'famous/core/Surface.js';


export class PushDownSurface extends Surface {
    
    elementClass = '';
    
    allocate(allocator) {
        return allocator.allocate(this.elementType, true);
    }
}