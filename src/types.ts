import * as PIXI from 'pixi.js';
import Matter from 'matter-js';

export interface GameObject {
    sprite: PIXI.Graphics | PIXI.Sprite;
    body: Matter.Body;
}