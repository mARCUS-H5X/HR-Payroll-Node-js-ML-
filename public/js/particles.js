/**
 * particles.js
 * A lightweight, subtle, professional cursor particle effect for SAI Payroll.
 * Uses requestAnimationFrame, disables on standard low power scenarios if possible.
 */

(function() {
  const canvas = document.getElementById('cursor-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = window.innerWidth;
  let height = window.innerHeight;
  let particles = [];
  
  // Throttle resizing and track pointer
  let pointerX = -100;
  let pointerY = -100;
  let isMoving = false;
  let movingTimeout;

  // Track cursor
  window.addEventListener('mousemove', (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    isMoving = true;
    
    // Spawn subtle particles on move
    if (Math.random() > 0.4) {
      particles.push(new Particle(pointerX, pointerY));
    }

    clearTimeout(movingTimeout);
    movingTimeout = setTimeout(() => { isMoving = false; }, 100);
  });

  // Handle window resize dynamically
  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  });

  // Initial setup
  canvas.width = width;
  canvas.height = height;

  class Particle {
    constructor(x, y) {
      this.x = x + (Math.random() * 10 - 5);
      this.y = y + (Math.random() * 10 - 5);
      
      this.size = Math.random() * 2 + 1;
      this.speedX = Math.random() * 1 - 0.5;
      this.speedY = Math.random() * -1 - 0.5; // Drift upwards slowly
      this.opacity = 0.5; // Very subtle
      
      // Teal/blue accent to fit the business theme
      const colors = ['rgba(79, 70, 229, ', 'rgba(16, 185, 129, ', 'rgba(99, 102, 241, '];
      this.colorBase = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.size *= 0.95; // Shrink
      this.opacity -= 0.015; // Fade out quickly
    }

    draw() {
      ctx.fillStyle = this.colorBase + this.opacity + ')';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);
    
    // Limits
    if (particles.length > 50) particles.shift();
    
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        
        // Remove dead particles
        if (particles[i].size <= 0.2 || particles[i].opacity <= 0) {
            particles.splice(i, 1);
            i--;
        }
    }
    
    requestAnimationFrame(render);
  }

  // Start loop 
  requestAnimationFrame(render);
})();
