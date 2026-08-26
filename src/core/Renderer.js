/**
 * @module Renderer
 * @description Mimicry Roguelike 핵심 렌더러 모듈.
 * 차세대 3D 다층 복셀(Voxel3DRenderer) 파이프라인을 온전히 상속 및 바인딩하여 100% 호환성을 제공합니다.
 */

import { Voxel3DRenderer } from '../renderer/Voxel3DRenderer.js';

export class Renderer extends Voxel3DRenderer {
  constructor(canvasId, tileSize) {
    super(canvasId, tileSize);
  }
}
