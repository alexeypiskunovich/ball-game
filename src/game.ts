import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { gsap } from 'gsap';
import { CONFIG } from './config';
import { GameObject } from './types';

export class Game {
    private app: PIXI.Application;
    private engine: Matter.Engine;
    private world: Matter.World;
    
    private projectile?: GameObject;
    private target?: GameObject;
    private obstacles: GameObject[] = [];
    private boundaries: Matter.Body[] = [];
    
    private gameEnded: boolean = false;
    private interactionStarted: boolean = false;
    private isDragging: boolean = false;
    private startTime: number = 0;
    private currentScale: number = 1;
    private checkIntervalId?: any;

    private dragStartPos: { x: number; y: number } | null = null;
    private dragStartGlobalPos: { x: number; y: number } | null = null;

    private winScreen = document.getElementById('win-screen') as HTMLElement;
    private loseScreen = document.getElementById('lose-screen') as HTMLElement;
    private tutorialHand = document.getElementById('tutorial-hand') as HTMLElement;
    private indicatorLine?: HTMLElement;

    constructor() {
        
        this.app = new PIXI.Application();
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        this.world.gravity.y = 0;
    }

    
    public async init() {
        await this.app.init({
            canvas: document.getElementById('pixi-canvas') as HTMLCanvasElement,
            width: CONFIG.gameWidth,
            height: CONFIG.gameHeight,
            backgroundColor: 0x000000,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true,
        });

        this.createStars();
        this.indicatorLine = this.createIndicatorLine();
        
        const runner = Matter.Runner.create();
        Matter.Runner.run(runner, this.engine);

        
        this.app.ticker.add(() => this.update());

        window.addEventListener('resize', () => this.handleResize());
        
        this.startGame();
    }

    private startGame() {
        this.resetGameState();
        
        this.createBackground();
        this.projectile = this.createProjectile();
        this.target = this.createTarget();
        this.obstacles = this.createObstacles();
        this.boundaries = this.createBoundaries();

        Matter.Composite.add(this.world, [
            this.projectile.body,
            this.target.body,
            ...this.obstacles.map(o => o.body),
            ...this.boundaries
        ]);

        this.setupProjectileInteractivity();
        
        Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => this.onCollision(e));
        
        this.handleResize();
        this.showTutorial();
    }

    private resetGameState() {
        this.gameEnded = false;
        this.interactionStarted = false;
        this.startTime = Date.now();
        if (this.checkIntervalId) clearInterval(this.checkIntervalId);

        Matter.Composite.clear(this.world, false);
        this.app.stage.removeChildren();
        this.obstacles = [];
        
        this.winScreen.classList.add('hidden');
        this.loseScreen.classList.add('hidden');
    }

    private createStars() {
        const starsContainer = document.getElementById('stars')!;
        if (!starsContainer) return;
        for (let i = 0; i < 150; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.setProperty('--opacity', (Math.random() * 0.5 + 0.2).toString());
            star.style.setProperty('--duration', `${Math.random() * 3 + 2}s`);
            starsContainer.appendChild(star);
        }
    }

    private createBackground() {
        const bg = new PIXI.Graphics();
        
        bg.setStrokeStyle({ width: 1, color: 0x2c3e50, alpha: 0.3 });
        const gridSize = 40;
        for (let x = 0; x <= CONFIG.gameWidth; x += gridSize) {
            bg.moveTo(x, 0).lineTo(x, CONFIG.gameHeight);
        }
        for (let y = 0; y <= CONFIG.gameHeight; y += gridSize) {
            bg.moveTo(0, y).lineTo(CONFIG.gameWidth, y);
        }
        bg.stroke();
        this.app.stage.addChild(bg);
    }

    private createProjectile(): GameObject {
        const graphics = new PIXI.Graphics()
            .circle(0, 0, 20)
            .fill(0xff4757)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
            
        graphics.x = 150;
        graphics.y = CONFIG.gameHeight / 2;
        this.app.stage.addChild(graphics);

        const body = Matter.Bodies.circle(graphics.x, graphics.y, 20, {
            restitution: CONFIG.projectileRestitution,
            friction: CONFIG.projectileFriction,
            frictionAir: CONFIG.projectileFrictionAir,
            density: CONFIG.projectileDensity
        });

        return { sprite: graphics, body };
    }

    private createTarget(): GameObject {
        const graphics = new PIXI.Graphics()
            .circle(0, 0, 30)
            .fill(0x2ed573)
            .stroke({ width: 2, color: 0xffffff, alpha: 0.7 });

        graphics.x = CONFIG.gameWidth - 100;
        graphics.y = CONFIG.gameHeight / 2;
        this.app.stage.addChild(graphics);

        const body = Matter.Bodies.circle(graphics.x, graphics.y, 30, {
            isStatic: true,
            isSensor: true
        });

        return { sprite: graphics, body };
    }

    private createObstacles(): GameObject[] {
        const obsList: GameObject[] = [];
        const count = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < count; i++) {
            const size = Math.random() * 40 + 30;
            const x = Math.random() * (CONFIG.gameWidth - 400) + 250;
            const y = Math.random() * (CONFIG.gameHeight - 100) + 50;

            const graphics = new PIXI.Graphics()
                .roundRect(-size/2, -size/2, size, size, 10)
                .fill(0x3742fa)
                .stroke({ width: 2, color: 0xffffff, alpha: 0.5 });

            graphics.x = x;
            graphics.y = y;
            this.app.stage.addChild(graphics);

            const body = Matter.Bodies.rectangle(x, y, size, size, {
                isStatic: true,
                restitution: 0.7,
                chamfer: { radius: 10 }
            });

            obsList.push({ sprite: graphics, body });
        }
        return obsList;
    }

    private createBoundaries(): Matter.Body[] {
        const t = 20;
        const w = CONFIG.gameWidth;
        const h = CONFIG.gameHeight;
        const opts = { isStatic: true, restitution: CONFIG.boundaryRestitution };
        
        return [
            Matter.Bodies.rectangle(w / 2, -t / 2, w, t, opts),
            Matter.Bodies.rectangle(w / 2, h + t / 2, w, t, opts),
            Matter.Bodies.rectangle(-t / 2, h / 2, t, h, opts),
            Matter.Bodies.rectangle(w + t / 2, h / 2, t, h, opts)
        ];
    }

    private createIndicatorLine(): HTMLElement {
        const line = document.createElement('div');
        line.className = 'indicator-line';
        line.style.display = 'none';
        document.getElementById('game-container')!.appendChild(line);
        return line;
    }

    private setupProjectileInteractivity() {
        if (!this.projectile) return;
        const s = this.projectile.sprite;
        s.eventMode = 'static';
        s.cursor = 'pointer';

        s.on('pointerdown', (e) => this.onDragStart(e));
        s.on('globalpointermove', (e) => this.onDragMove(e));
        s.on('pointerup', () => this.onDragEnd());
        s.on('pointerupoutside', () => this.onDragEnd());
    }

    private onDragStart(event: PIXI.FederatedPointerEvent) {
        if (this.gameEnded || this.isDragging || !this.projectile) return;

        this.dragStartPos = { x: this.projectile.sprite.x, y: this.projectile.sprite.y };
        this.dragStartGlobalPos = { x: event.global.x, y: event.global.y };
        this.isDragging = true;

        Matter.Body.setStatic(this.projectile.body, true);
        if (this.indicatorLine) this.indicatorLine.style.display = 'block';

        if (!this.interactionStarted) {
            this.interactionStarted = true;
            this.hideTutorial();
        }
    }

    private onDragMove(event: PIXI.FederatedPointerEvent) {
    if (!this.isDragging || this.gameEnded || !this.projectile || !this.dragStartGlobalPos || !this.dragStartPos) return;

    const dx = (event.global.x - this.dragStartGlobalPos.x) / this.currentScale;
    const dy = (event.global.y - this.dragStartGlobalPos.y) / this.currentScale;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let constrainedX = this.dragStartPos.x + dx;
    let constrainedY = this.dragStartPos.y + dy;

    
    if (distance > CONFIG.maxDragDistance) {
        constrainedX = this.dragStartPos.x + Math.cos(angle) * CONFIG.maxDragDistance;
        constrainedY = this.dragStartPos.y + Math.sin(angle) * CONFIG.maxDragDistance;
    }

    
    const margin = 25; 
    constrainedX = Math.max(margin, Math.min(CONFIG.gameWidth - margin, constrainedX));
    constrainedY = Math.max(margin, Math.min(CONFIG.gameHeight - margin, constrainedY));

    Matter.Body.setPosition(this.projectile.body, { x: constrainedX, y: constrainedY });
    this.updateIndicatorLine(this.dragStartPos, { x: constrainedX, y: constrainedY });
}

    private onDragEnd() {
        if (!this.isDragging || !this.projectile || !this.dragStartPos) return;
        this.isDragging = false;

        const dx = this.dragStartPos.x - this.projectile.body.position.x;
        const dy = this.dragStartPos.y - this.projectile.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const forceMag = Math.min(distance / CONFIG.maxDragDistance, 1) * CONFIG.maxLaunchForce;
        
        Matter.Body.setStatic(this.projectile.body, false);
        Matter.Body.applyForce(this.projectile.body, this.projectile.body.position, {
            x: dx * forceMag,
            y: dy * forceMag
        });

        this.projectile.sprite.eventMode = 'none';
        if (this.indicatorLine) this.indicatorLine.style.display = 'none';

        this.checkGameStatus();
    }

    private onCollision(event: Matter.IEventCollision<Matter.Engine>) {
        if (this.gameEnded || !this.projectile || !this.target) return;

        for (const pair of event.pairs) {
            if ((pair.bodyA === this.projectile.body && pair.bodyB === this.target.body) ||
                (pair.bodyA === this.target.body && pair.bodyB === this.projectile.body)) {
                
                gsap.to(this.target.sprite.scale, {
                    x: 1.2, y: 1.2, duration: 0.2, yoyo: true, repeat: 1
                });
                this.winGame();
            }
        }
    }

    private checkGameStatus() {
        this.checkIntervalId = setInterval(() => {
            if (this.gameEnded || !this.projectile) return;

            const vel = this.projectile.body.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

            if (speed < CONFIG.minVelocityThreshold || (Date.now() - this.startTime > CONFIG.winTimeout)) {
                this.loseGame();
                clearInterval(this.checkIntervalId);
            }
        }, 100);
    }

    private winGame() {
        this.gameEnded = true;
        this.winScreen.classList.remove('hidden');
        gsap.fromTo(this.winScreen, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out" });
    }

    private loseGame() {
        this.gameEnded = true;
        this.loseScreen.classList.remove('hidden');
        gsap.fromTo(this.loseScreen, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out" });
    }

    private update() {
        if (this.projectile) {
            this.projectile.sprite.x = this.projectile.body.position.x;
            this.projectile.sprite.y = this.projectile.body.position.y;
            this.projectile.sprite.rotation = this.projectile.body.angle;
        }
        this.obstacles.forEach(obs => {
            obs.sprite.x = obs.body.position.x;
            obs.sprite.y = obs.body.position.y;
            obs.sprite.rotation = obs.body.angle;
        });
    }

    private updateIndicatorLine(start: {x:number, y:number}, end: {x:number, y:number}) {
    if (!this.indicatorLine || !this.app.canvas) return;
    
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    
    const canvasRect = this.app.canvas.getBoundingClientRect();

    
    this.indicatorLine.style.width = `${length * this.currentScale}px`;
    
    
    this.indicatorLine.style.left = `${canvasRect.left + (start.x * this.currentScale)}px`;
    this.indicatorLine.style.top = `${canvasRect.top + (start.y * this.currentScale)}px`;
    
    this.indicatorLine.style.transform = `rotate(${angle}rad)`;
}

    private showTutorial() {
    if (!this.projectile || !this.app.canvas) return;

    this.tutorialHand.style.display = 'block';
    
    
    const canvasRect = this.app.canvas.getBoundingClientRect();
    const screenX = canvasRect.left + (this.projectile.sprite.x * this.currentScale);
    const screenY = canvasRect.top + (this.projectile.sprite.y * this.currentScale);

    
    this.tutorialHand.style.left = `${screenX}px`;
    this.tutorialHand.style.top = `${screenY}px`;

    
    gsap.killTweensOf(this.tutorialHand);
    gsap.fromTo(this.tutorialHand, 
        { x: 20, y: 20 }, 
        { x: -20, y: -20, duration: 1, yoyo: true, repeat: -1, ease: "sine.inOut" }
    );
}

    private hideTutorial() {
        this.tutorialHand.style.display = 'none';
        gsap.killTweensOf(this.tutorialHand);
    }

    private handleResize() {
        const container = document.getElementById('game-container');
        if (!container) return;
        
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const ratio = CONFIG.gameWidth / CONFIG.gameHeight;
        
        let rw, rh;
        if (cw / ch > ratio) {
            rh = ch; rw = rh * ratio;
        } else {
            rw = cw; rh = rw / ratio;
        }

        this.app.renderer.resize(rw, rh);
        this.currentScale = rw / CONFIG.gameWidth;
        this.app.stage.scale.set(this.currentScale);
    }
}