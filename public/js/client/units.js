// Vista de una unidad (modelo 3D + barras HTML + animaciones).
import * as THREE from 'three';
import { createModel } from './models.js';
import { ITEMS } from '../game/data/items.js';
import { LINES, formScale } from '../game/data/pokemon.js';
import { F } from '../game/combat.js';
import { icon, itemIcon } from './icons.js';

const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(20,20,40,0.55)');
  grd.addColorStop(1, 'rgba(20,20,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const shadowGeo = new THREE.PlaneGeometry(1, 1);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const iceMat = new THREE.MeshBasicMaterial({ color: 0xbdf4ff, transparent: true, opacity: 0.45, depthWrite: false });
const iceGeo = new THREE.BoxGeometry(1, 1, 1);

const STAR_HTML = ['', '★', '★★', '★★★'];

export class UnitView {
  constructor(ctx, o) {
    this.ctx = ctx;
    this.id = o.id;
    this.uid = o.uid;
    this.form = o.form;
    this.line = o.line;
    this.star = o.star || 1;
    this.shiny = !!o.shiny;
    this.side = o.side ?? 0;
    this.enemy = !!o.enemy;
    this.boss = !!o.boss;
    this.items = o.items || [];
    this.fr = o.fr || 0;
    this.group = new THREE.Group();
    this.scaleMul = (o.scaleMul ?? 1) * 1.3;
    this.buildModel();
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.13;
    this.shadow = sh;
    this.group.add(sh);
    ctx.scene.add(this.group);

    this.pos = new THREE.Vector3();
    this.yaw = this.enemy ? 0 : Math.PI;
    this.targetYaw = this.yaw;
    this.phase = Math.random() * 10;
    this.anim = null;
    this.flash = 0;
    this.hp = o.hp ?? 1; this.maxHp = o.maxHp ?? 1; this.mana = o.mana ?? 0; this.maxMana = o.maxMana ?? 0; this.shield = o.shield ?? 0;
    this.flags = 0;
    this.dead = false;
    this.dyna = 0;
    this.dynaTarget = 0;
    this.lastHp = this.hp;
    this.fxTimer = 0;
    this.walkAmt = 0;
    this.buildBar(o.bench);
    this.updateBar();
  }

  buildModel() {
    const sMul = formScale(this.line, this.star) * this.scaleMul * (this.boss ? 1.45 : 1);
    this.model = createModel(this.form, this.shiny, { scale: sMul });
    this.group.add(this.model.root);
    this.baseScale = this.model.root.scale.x;
    this.height = this.model.height;
  }

  swapModel(form, shiny, star) {
    this.group.remove(this.model.root);
    this.model.mat.dispose();
    this.form = form; this.shiny = shiny; if (star) this.star = star;
    this.buildModel();
    this.updateBar(true);
  }

  buildBar(bench) {
    const el = document.createElement('div');
    el.className = 'ubar' + (this.enemy ? ' enemy' : '') + (bench ? ' bench' : '');
    el.innerHTML = '<div class="stars"></div><div class="hp"><u></u><i></i><s></s></div><div class="mp"><i></i></div><div class="its"></div><span class="st"></span><span class="fr"></span>';
    this.ctx.overlay.appendChild(el);
    this.bar = el;
    this.$stars = el.querySelector('.stars');
    this.$hp = el.querySelector('.hp i');
    this.$hpGhost = el.querySelector('.hp u');
    this.$sh = el.querySelector('.hp s');
    this.$mp = el.querySelector('.mp i');
    this.$mpWrap = el.querySelector('.mp');
    this.$its = el.querySelector('.its');
    this.$st = el.querySelector('.st');
    this.$fr = el.querySelector('.fr');
  }

  setBench(on) { this.bar.classList.toggle('bench', on); this.onBench = on; }

  updateBar(full = false) {
    if (full || this._starsKey !== this.star + ':' + this.shiny) {
      this._starsKey = this.star + ':' + this.shiny;
      this.$stars.innerHTML = (this.shiny ? icon('sparkle', 'shiny') : '') + STAR_HTML[this.star];
      this.$stars.className = 'stars s' + this.star;
    }
    const k = this.items.join(',');
    if (full || this._itemsKey !== k) {
      this._itemsKey = k;
      this.$its.innerHTML = this.items.map((it) => itemIcon(ITEMS[it], true)).join('');
    }
    const fr = this.fr >= 5;
    if (this._fr !== fr) { this._fr = fr; this.$fr.innerHTML = fr ? icon('heart') : ''; }
    const total = Math.max(this.maxHp, this.hp + this.shield);
    const hpW = Math.max(0, this.hp / total) * 100;
    this.$hp.style.width = hpW + '%';
    this.$hpGhost.style.width = hpW + '%';
    this.$sh.style.left = hpW + '%';
    this.$sh.style.width = (this.shield / total) * 100 + '%';
    const mp = this.maxMana > 0 ? Math.min(1, this.mana / this.maxMana) : 0;
    this.$mp.style.width = mp * 100 + '%';
    this.$mpWrap.classList.toggle('full', mp >= 1);
    const f = this.flags;
    if (this._flagsShown !== f) {
      this._flagsShown = f;
      let st = '';
      if (f & F.SLEEP) st += icon('s_sleep', 'st-sleep');
      if (f & F.PARA) st += icon('electrico', 'st-para');
      if (f & F.FREEZE) st += icon('hielo', 'st-freeze');
      if (f & F.FLINCH) st += icon('star', 'st-flinch');
      if (f & F.BURN) st += icon('fuego', 'st-burn');
      if (f & F.CONFUSE) st += icon('s_confuse', 'st-conf');
      if (f & F.SLOW) st += icon('s_slow', 'st-slow');
      if (f & F.DISGUISE) st += icon('fantasma', 'st-dis');
      this.$st.innerHTML = st;
    }
  }

  setState(hp, maxHp, mana, maxMana, shield, flags) {
    if (hp < this.hp - 1) this.hitFlash();
    this.hp = hp; this.maxHp = maxHp; this.mana = mana; this.maxMana = maxMana; this.shield = shield;
    const prev = this.flags;
    this.flags = flags;
    if ((flags & F.FREEZE) && !(prev & F.FREEZE)) this.showIce(true);
    if (!(flags & F.FREEZE) && (prev & F.FREEZE)) this.showIce(false);
    this.dynaTarget = flags & F.DYNA && !this.boss ? 1 : 0;
    this.updateBar();
  }

  showIce(on) {
    if (on && !this.ice) {
      this.ice = new THREE.Mesh(iceGeo, iceMat);
      const s = Math.max(0.9, this.model.radius * 2.2);
      this.ice.scale.set(s, this.height * 1.1 + 0.2, s);
      this.ice.position.y = (this.height * 1.1 + 0.2) / 2;
      this.group.add(this.ice);
    } else if (!on && this.ice) {
      this.group.remove(this.ice);
      this.ice = null;
      this.ctx.fx.burst(this.group.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xbdf4ff, 10, 3, 0.3, 0.4);
    }
  }

  place(v) {
    this.pos.copy(v);
    this.group.position.copy(v);
    this.anim = null;
  }

  moveTo(v, ms = 400, hop = 0.35) {
    this.anim = { kind: 'move', from: this.group.position.clone(), to: v.clone(), t: 0, d: ms / 1000, hop };
    this.pos.copy(v);
    const d = v.clone().sub(this.group.position);
    if (d.lengthSq() > 0.001) this.targetYaw = Math.atan2(d.x, d.z);
  }

  faceTo(v) {
    const d = v.clone().sub(this.group.position);
    if (d.lengthSq() > 0.001) this.targetYaw = Math.atan2(d.x, d.z);
  }

  faceYaw(y) { this.targetYaw = y; }

  lunge(target) {
    this.faceTo(target);
    const dir = target.clone().sub(this.pos).setY(0).normalize();
    this.act = { kind: 'lunge', t: 0, d: 0.28, dir };
  }

  shoot(target) {
    this.faceTo(target);
    this.act = { kind: 'recoil', t: 0, d: 0.22 };
  }

  castAnim() { this.act = { kind: 'cast', t: 0, d: 0.5 }; }

  jump() { this.act = { kind: 'jump', t: 0, d: 0.45 }; }

  celebrate() { this.act = { kind: 'celebrate', t: 0, d: 1.6 }; }

  hitFlash() { this.flash = 1; this.shake = 0.15; }

  die() {
    this.dead = true;
    this.anim = null;
    this.act = { kind: 'die', t: 0, d: 0.6 };
    this.bar.style.display = 'none';
  }

  evolveFx(onSwap) {
    this.act = { kind: 'evolve', t: 0, d: 2.0, onSwap, swapped: false };
  }

  update(dt, t) {
    const g = this.group;
    // Movimiento.
    if (this.anim && this.anim.kind === 'move') {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.d);
      g.position.lerpVectors(a.from, a.to, k);
      g.position.y = Math.sin(k * Math.PI) * a.hop;
      if (k >= 1) this.anim = null;
    } else if (!this.dragging) {
      g.position.x += (this.pos.x - g.position.x) * Math.min(1, dt * 14);
      g.position.z += (this.pos.z - g.position.z) * Math.min(1, dt * 14);
      g.position.y += (this.pos.y - g.position.y) * Math.min(1, dt * 14);
    }
    // Giro suave.
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 10);
    const root = this.model.root;
    const body = this.model.body;
    root.rotation.y = this.yaw;

    // Dinamax.
    this.dyna += (this.dynaTarget - this.dyna) * Math.min(1, dt * 3);
    const sc = this.baseScale * (1 + this.dyna * 0.9);
    root.scale.setScalar(sc);
    this.shadow.scale.setScalar(Math.max(0.7, this.model.radius * 2.6) * (1 + this.dyna * 0.9) * (this.boss ? 1.3 : 1));

    // Idle.
    const stunned = this.flags & F.STUN;
    const sleeping = this.flags & F.SLEEP;
    const frozen = this.flags & F.FREEZE;
    const speed = frozen ? 0 : sleeping ? 0.4 : 1;
    this.phase += dt * speed;
    const ph = this.phase * 3.2;
    const floatY = this.model.float ? 0.18 + Math.sin(ph * 0.7) * 0.06 : 0;
    body.position.y = floatY + (this.model.float ? 0 : Math.abs(Math.sin(ph)) * 0.025);
    body.scale.set(1 + Math.sin(ph * 2) * 0.012, 1 - Math.sin(ph * 2) * 0.012, 1);
    body.rotation.z = sleeping ? 0.25 : 0;
    if (this.walkAmt > 0.01) {
      const w = this.phase * 11;
      body.position.y += Math.abs(Math.sin(w)) * 0.17 * this.walkAmt;
      body.rotation.z += Math.sin(w) * 0.1 * this.walkAmt;
    }
    body.rotation.x = 0;
    const rig = this.model.rig;
    if (rig.tail) rig.tail.rotation.y = Math.sin(ph * 1.3) * 0.35 * speed;
    if (rig.head) { rig.head.rotation.z = Math.sin(ph * 0.6) * 0.06; rig.head.rotation.x = sleeping ? 0.35 : 0; }
    const flap = this.model.data.arch === 'bird' ? 0.5 : 0.18;
    if (rig.wingL) rig.wingL.rotation.z = Math.sin(ph * 2.2) * flap * speed;
    if (rig.wingR) rig.wingR.rotation.z = -Math.sin(ph * 2.2) * flap * speed;
    if (rig.armL) rig.armL.rotation.x = Math.sin(ph) * 0.12 * speed;
    if (rig.armR) rig.armR.rotation.x = -Math.sin(ph) * 0.12 * speed;
    if (this.flags & F.PARA && Math.random() < 0.3) body.position.x = (Math.random() - 0.5) * 0.06; else body.position.x = 0;

    // Acciones.
    const a = this.act;
    if (a) {
      a.t += dt;
      const k = Math.min(1, a.t / a.d);
      switch (a.kind) {
        case 'lunge': {
          const e = Math.sin(k * Math.PI);
          root.position.set(a.dir.x * e * 0.4, 0, a.dir.z * e * 0.4);
          if (rig.armL) rig.armL.rotation.x = -e * 1.4;
          if (rig.armR) rig.armR.rotation.x = -e * 1.4;
          if (rig.head) rig.head.rotation.x = e * 0.2;
          break;
        }
        case 'recoil': {
          const e = Math.sin(k * Math.PI);
          body.rotation.x = -e * 0.15;
          if (rig.armL) rig.armL.rotation.x = -e * 1.2;
          break;
        }
        case 'cast': {
          const e = Math.sin(k * Math.PI);
          body.position.y += e * 0.5;
          root.rotation.y = this.yaw + k * Math.PI * 2;
          if (rig.armL) rig.armL.rotation.z = e * 1.2;
          if (rig.armR) rig.armR.rotation.z = -e * 1.2;
          break;
        }
        case 'jump': {
          body.position.y += Math.sin(k * Math.PI) * 0.45;
          break;
        }
        case 'celebrate': {
          body.position.y += Math.abs(Math.sin(k * Math.PI * 4)) * 0.4;
          if (rig.armL) rig.armL.rotation.z = 1.2;
          if (rig.armR) rig.armR.rotation.z = -1.2;
          break;
        }
        case 'die': {
          root.rotation.z = k * 1.4;
          root.scale.setScalar(sc * (1 - k));
          this.shadow.scale.multiplyScalar(1 - k);
          break;
        }
        case 'evolve': {
          // Destellos blancos alternando forma (como en los juegos).
          const pulse = Math.sin(a.t * (6 + a.t * 10)) * 0.5 + 0.5;
          this.model.mat.emissive.setRGB(pulse, pulse, pulse);
          root.scale.setScalar(sc * (1 + Math.sin(a.t * 14) * 0.08 * k));
          if (!a.swapped && k > 0.55) { a.swapped = true; a.onSwap && a.onSwap(); }
          break;
        }
      }
      if (k >= 1) {
        if (a.kind !== 'die') {
          root.position.set(0, 0, 0);
          if (this.model.mat) this.model.mat.emissive.setRGB(0, 0, 0);
        }
        this.act = a.kind === 'die' ? a : null;
        if (a.kind === 'die') this.removed = true;
      }
    } else {
      root.position.set(0, 0, 0);
    }

    // Destello de golpe / Dinamax.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      this.model.mat.emissive.setRGB(this.flash * 0.9, this.flash * 0.9, this.flash * 0.9);
    } else if (this.dyna > 0.05 && (!a || a.kind !== 'evolve')) {
      const p = (Math.sin(t * 6) * 0.5 + 0.5) * 0.35 * this.dyna;
      this.model.mat.emissive.setRGB(p * 1.2, p * 0.1, p * 0.2);
    } else if (!a || a.kind !== 'evolve') {
      this.model.mat.emissive.setRGB(0, 0, 0);
    }

    // Partículas de estado.
    this.fxTimer -= dt;
    if (this.fxTimer <= 0 && !this.dead) {
      this.fxTimer = 0.25;
      const top = g.position.clone().add(new THREE.Vector3(0, this.height * (1 + this.dyna * 0.9) * 0.9, 0));
      if (this.flags & F.BURN) this.ctx.fx.rising(g.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xff7b2e, 2, 0.3);
      if (this.flags & F.SLEEP && Math.random() < 0.5) this.ctx.fx.text(top, 'z', 'txt small', 1.2, 12);
      if (this.flags & F.CONFUSE) this.ctx.fx.sparkle(top, 0xffe060, 2, 0.35);
      if (this.shiny && Math.random() < 0.18) this.ctx.fx.sparkle(g.position.clone().add(new THREE.Vector3(0, this.height * 0.6, 0)), 0xffffff, 1, 0.5);
      if (this.dyna > 0.5) this.ctx.fx.rising(g.position.clone(), 0xff2050, 3, 0.9);
    }

    // Barra HTML.
    if (!this.dead) {
      const hTop = this.height * (1 + this.dyna * 0.9) + 0.25;
      const s = this.ctx.engine.toScreen(g.position.clone().add(new THREE.Vector3(0, hTop, 0)));
      this.bar.style.transform = `translate(${s.x - 32}px, ${s.y - 30}px)`;
      this.bar.style.display = s.behind || this.hideBar ? 'none' : '';
    }
  }

  topPos() {
    return this.group.position.clone().add(new THREE.Vector3(0, this.height * (1 + this.dyna * 0.9) * 0.85, 0));
  }
  midPos() {
    return this.group.position.clone().add(new THREE.Vector3(0, this.height * (1 + this.dyna * 0.9) * 0.5, 0));
  }

  dispose() {
    this.ctx.scene.remove(this.group);
    this.model.mat.dispose();
    this.bar.remove();
  }
}
