/**
 * Event Detection
 * Handles sub-frame line crossing detection and interpolation
 */
class EventDetector {
    constructor() {
        this.previousPositions = new Map(); // Track previous positions by ID
    }

    /**
     * Detect line crossing between two consecutive positions
     */
    detectLineCrossing(prevPos, currPos, line, prevTime, currTime) {
        if (!prevPos || !currPos || !line) return null;
        
        // Check if crossing occurred
        const crossing = this.checkLineCrossing(prevPos, currPos, line);
        if (!crossing.crossed) return null;
        
        // Calculate interpolated crossing time
        const tFraction = crossing.tFraction;
        const crossingTime = prevTime + (currTime - prevTime) * tFraction;
        
        // Calculate crossing position
        const crossingPos = {
            x: prevPos.x + (currPos.x - prevPos.x) * tFraction,
            y: prevPos.y + (currPos.y - prevPos.y) * tFraction
        };
        
        return {
            crossed: true,
            time: crossingTime,
            position: crossingPos,
            tFraction: tFraction
        };
    }

    /**
     * Check if line crossing occurred and calculate interpolation fraction
     */
    checkLineCrossing(p1, p2, line) {
        // Line defined by two points: line.p1 and line.p2
        // Check if segment p1-p2 crosses line segment line.p1-line.p2
        
        const result = this.lineSegmentIntersection(
            p1, p2,
            line.p1, line.p2
        );
        
        if (!result.intersects) {
            return { crossed: false, tFraction: 0 };
        }
        
        // Check if intersection is within both segments
        const t = result.t; // Parameter for p1-p2 segment
        const u = result.u; // Parameter for line segment
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return { crossed: true, tFraction: t };
        }
        
        return { crossed: false, tFraction: 0 };
    }

    /**
     * Calculate intersection between two line segments
     */
    lineSegmentIntersection(p1, p2, p3, p4) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;
        const x4 = p4.x, y4 = p4.y;
        
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 1e-10) {
            // Lines are parallel
            return { intersects: false, t: 0, u: 0 };
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        return { intersects: true, t: t, u: u };
    }

    /**
     * Detect when object crosses a vertical line (x = constant)
     */
    detectVerticalLineCrossing(prevPos, currPos, lineX, prevTime, currTime) {
        if (!prevPos || !currPos) return null;
        
        // Check if crossing occurred
        const prevSide = prevPos.x < lineX;
        const currSide = currPos.x < lineX;
        
        if (prevSide === currSide) {
            return null; // No crossing
        }
        
        // Calculate interpolation fraction
        const dx = currPos.x - prevPos.x;
        if (Math.abs(dx) < 1e-10) return null; // No movement in x
        
        const tFraction = (lineX - prevPos.x) / dx;
        
        if (tFraction < 0 || tFraction > 1) return null;
        
        // Calculate crossing time and position
        const crossingTime = prevTime + (currTime - prevTime) * tFraction;
        const crossingY = prevPos.y + (currPos.y - prevPos.y) * tFraction;
        
        return {
            crossed: true,
            time: crossingTime,
            position: { x: lineX, y: crossingY },
            tFraction: tFraction,
            direction: currPos.x > prevPos.x ? 'right' : 'left'
        };
    }

    /**
     * Detect when object crosses a horizontal line (y = constant)
     */
    detectHorizontalLineCrossing(prevPos, currPos, lineY, prevTime, currTime) {
        if (!prevPos || !currPos) return null;
        
        // Check if crossing occurred
        const prevSide = prevPos.y < lineY;
        const currSide = currPos.y < lineY;
        
        if (prevSide === currSide) {
            return null; // No crossing
        }
        
        // Calculate interpolation fraction
        const dy = currPos.y - prevPos.y;
        if (Math.abs(dy) < 1e-10) return null; // No movement in y
        
        const tFraction = (lineY - prevPos.y) / dy;
        
        if (tFraction < 0 || tFraction > 1) return null;
        
        // Calculate crossing time and position
        const crossingTime = prevTime + (currTime - prevTime) * tFraction;
        const crossingX = prevPos.x + (currPos.x - prevPos.x) * tFraction;
        
        return {
            crossed: true,
            time: crossingTime,
            position: { x: crossingX, y: lineY },
            tFraction: tFraction,
            direction: currPos.y > prevPos.y ? 'down' : 'up'
        };
    }

    /**
     * Track position for an object and detect events
     */
    trackPosition(objectId, position, timestamp) {
        const prevData = this.previousPositions.get(objectId);
        
        // Store current position
        this.previousPositions.set(objectId, {
            position: position,
            timestamp: timestamp
        });
        
        return prevData;
    }

    /**
     * Clear tracking data
     */
    clearTracking(objectId = null) {
        if (objectId) {
            this.previousPositions.delete(objectId);
        } else {
            this.previousPositions.clear();
        }
    }

    /**
     * Detect ground contact (landing) based on vertical movement
     */
    detectLanding(prevPos, currPos, groundY, minVerticalSpeed = 2) {
        if (!prevPos || !currPos) return false;
        
        // Check if moving downward and crossing ground level
        const verticalSpeed = currPos.y - prevPos.y;
        const crossedGround = prevPos.y < groundY && currPos.y >= groundY;
        
        return crossedGround && verticalSpeed >= minVerticalSpeed;
    }

    /**
     * Detect takeoff based on vertical movement
     */
    detectTakeoff(prevPos, currPos, groundY, minVerticalSpeed = 2) {
        if (!prevPos || !currPos) return false;
        
        // Check if moving upward and leaving ground level
        const verticalSpeed = prevPos.y - currPos.y; // Negative y is up
        const leftGround = prevPos.y >= groundY && currPos.y < groundY;
        
        return leftGround && verticalSpeed >= minVerticalSpeed;
    }

    /**
     * Calculate velocity between two positions
     */
    calculateVelocity(prevPos, currPos, prevTime, currTime) {
        if (!prevPos || !currPos || prevTime >= currTime) return null;
        
        const dt = currTime - prevTime;
        const dx = currPos.x - prevPos.x;
        const dy = currPos.y - prevPos.y;
        
        return {
            x: dx / dt,
            y: dy / dt,
            magnitude: Math.sqrt(dx * dx + dy * dy) / dt
        };
    }

    /**
     * Detect direction change (useful for finding peak of jump)
     */
    detectDirectionChange(prevVel, currVel, axis = 'y') {
        if (!prevVel || !currVel) return false;
        
        const prevSign = Math.sign(prevVel[axis]);
        const currSign = Math.sign(currVel[axis]);
        
        return prevSign !== currSign && prevSign !== 0;
    }
}