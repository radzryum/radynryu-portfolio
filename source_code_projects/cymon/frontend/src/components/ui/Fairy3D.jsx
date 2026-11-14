import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three-stdlib'
import { AdditiveBlending, BufferGeometry, CanvasTexture, DataTexture, Float32BufferAttribute, SRGBColorSpace, TextureLoader, Vector3 } from 'three'
import { isSpeaking, getVoiceLevel } from '../../lib/voiceBuddy'
import ButterflyFairy from './ButterflyFairy'

// Five-mood director: great / good / okay / sad / very_bad. Faces come from
// VRoid morphs, body language from head/chest/arm/hand/finger bones, and
// cyclic overlays (pump, nod, comfort cycle, worry eye cycle) keep her alive.
// She materializes magically out of the portal Ã¢â‚¬â€ fairies appear, not walk.
function moodFiveKey(mood) {
  if (mood === 'great') return 'great'
  if (mood === 'good') return 'good'
  if (mood === 'sad') return 'sad'
  if (mood === 'very_bad') return 'verybad'
  return 'okay'
}

// Emotion -> VRoid morph targets (weights 0..1). Talking overrides the mouth.
// Enhanced: Binawasan ang pagka-extreme para mas natural at soft ang mukha
const EMOTION_TARGETS = {
  // Great is the bright happy face: big smile, brows up, and eyes WIDE
  // open. Fcl_ALL_Joy is kept low because strong Joy squints the eyes
  // shut (sleepy look); Fcl_EYE_Surprised reopens them while Fcl_MTH_Joy
  // keeps the big smile. Only body language differs from good besides this.
  great: { Fcl_ALL_Joy: 0.25, Fcl_BRW_Joy: 0.3, Fcl_MTH_Joy: 0.45, Fcl_MTH_Fun: 0.15, Fcl_EYE_Surprised: 0.22 },
  good: { Fcl_ALL_Joy: 0.3, Fcl_BRW_Joy: 0.3, Fcl_MTH_Joy: 0.2, Fcl_MTH_Fun: 0.08 },
  okay: { Fcl_ALL_Fun: 0.15, Fcl_MTH_Small: 0.1, Fcl_BRW_Joy: 0.05 },
  sad: { Fcl_ALL_Sorrow: 0.45, Fcl_EYE_Sorrow: 0.3, Fcl_BRW_Sorrow: 0.6, Fcl_MTH_Sorrow: 0.4, Fcl_EYE_Close: 0.05 },
  verybad: { Fcl_ALL_Sorrow: 0.7, Fcl_EYE_Sorrow: 0.7, Fcl_BRW_Sorrow: 0.8, Fcl_MTH_Sorrow: 0.4, Fcl_MTH_Small: 0.1, Fcl_EYE_Close: 0.15 },
}
// Finger curl direction (verified by headless screenshot, not by guessing).
const FINGER_AXIS = 'X'
const FINGER_SIGN = 1
const MOUTH_VOWELS = ['Fcl_MTH_A', 'Fcl_MTH_I', 'Fcl_MTH_U', 'Fcl_MTH_E', 'Fcl_MTH_O']
const MOUTH_TARGETS = new Set([
  ...MOUTH_VOWELS, 'Fcl_MTH_Close', 'Fcl_MTH_Neutral', 'Fcl_MTH_Joy',
  'Fcl_MTH_Sorrow', 'Fcl_MTH_Surprised', 'Fcl_MTH_Angry', 'Fcl_MTH_Fun',
  'Fcl_MTH_Small', 'Fcl_MTH_Large', 'Fcl_MTH_Up', 'Fcl_MTH_Down',
])
// Union of every morph any mood can own Ã¢â‚¬â€ eased every frame so switching
// feelings always fades the old expression out instead of leaking it.
const ALL_MORPH_NAMES = new Set([
  ...Object.values(EMOTION_TARGETS).flatMap((m) => Object.keys(m)),
  ...MOUTH_TARGETS,
  'Fcl_EYE_Close',
  'Fcl_EYE_Surprised',
])

const WING_TINT = { blossom: '#ffffff', ocean: '#d8f4ff', sunny: '#fff3d6' }
// Close-up portrait: face-centered framing so expressions read clearly.
// Wings stay in frame on desktop thanks to the wide (max-w-2xl) modal.
// Measured from the GLB (gown hem ~0.60, head top ~1.62 local units):
// scale/GROUP_Y fill the frame down to the bottom edge so she stands
// grounded instead of hovering mid-stage. Her size never changes across
// screens — narrow phones fold her wings instead (see foldBase), which is
// what lets her stay big AND keep her wings inside a narrow frame.
const GROUP_Y = -0.635
const CAM_TARGET = [0, 0.65, 0]

function collectMorphs(scene) {
  const out = []
  scene.traverse((obj) => {
    if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
      out.push({ dict: obj.morphTargetDictionary, infl: obj.morphTargetInfluences })
    }
  })
  return out
}

function setMorph(morphs, name, value) {
  for (const { dict, infl } of morphs) {
    const idx = dict[name]
    if (idx !== undefined) infl[idx] = value
  }
}

function FairyModel({ mood, recording, wingTint }) {
  const gltf = useLoader(GLTFLoader, '/models/cymon-fairy.glb')
  const group = useRef(null)
  const wingL = useRef(null)
  const wingR = useRef(null)
  const glowLMat = useRef(null)
  const glowRMat = useRef(null)
  const rimLMat = useRef(null)
  const rimRMat = useRef(null)
  const morphs = useMemo(() => collectMorphs(gltf.scene), [gltf.scene])
  const bones = useMemo(() => {
    const found = { fingersL: [], fingersR: [], thumbsL: [], thumbsR: [] }
    // Authoritative bones are the ones the skins are bound to
    const skinned = {}
    gltf.scene.traverse((obj) => {
      if (obj.isSkinnedMesh && obj.skeleton) {
        for (const b of obj.skeleton.bones) skinned[b.name] = b
      }
    })
    const named = {}
    gltf.scene.traverse((obj) => {
      const n = String(obj.name || '')
      if (n && !(n in named)) named[n] = obj
    })
    const pick = (n) => skinned[n] || named[n]
    const pushTo = (arr, n) => {
      const b = skinned[n] || named[n]
      if (b) arr.push(b)
    }
    found.head = pick('J_Bip_C_Head')
    found.chest = pick('J_Bip_C_Chest')
    found.upperL = pick('J_Bip_L_UpperArm')
    found.upperR = pick('J_Bip_R_UpperArm')
    found.foreL = pick('J_Bip_L_LowerArm')
    found.foreR = pick('J_Bip_R_LowerArm')
    found.handL = pick('J_Bip_L_Hand')
    found.handR = pick('J_Bip_R_Hand')
    found.eyeL = pick('J_Adj_L_FaceEye') || pick('LeftEye')
    found.eyeR = pick('J_Adj_R_FaceEye') || pick('RightEye')
    gltf.scene.traverse((obj) => {
      const n = String(obj.name || '')
      if (/^J_Bip_L_(Index|Middle|Ring|Little)[123]$/.test(n)) pushTo(found.fingersL, n)
      else if (/^J_Bip_R_(Index|Middle|Ring|Little)[123]$/.test(n)) pushTo(found.fingersR, n)
      else if (/^J_Bip_L_Thumb[123]$/.test(n)) pushTo(found.thumbsL, n)
      else if (/^J_Bip_R_Thumb[123]$/.test(n)) pushTo(found.thumbsR, n)
    })

    const resetBone = (b) => {
      if (!b || !b.rotation) return
      if (b.userData.bindX === undefined) {
        b.userData.bindX = b.rotation.x
        b.userData.bindY = b.rotation.y
        b.userData.bindZ = b.rotation.z
      }
      b.rotation.x = b.userData.bindX
      b.rotation.y = b.userData.bindY
      b.rotation.z = b.userData.bindZ
      for (const k of Object.keys(b.userData)) {
        if (k.startsWith('rot')) delete b.userData[k]
      }
      b.userData.baseX = b.userData.bindX
      b.userData.baseY = b.userData.bindY
      b.userData.baseZ = b.userData.bindZ
    }
    for (const b of Object.values(found)) {
      if (Array.isArray(b)) b.forEach(resetBone)
      else resetBone(b)
    }
    for (const { infl } of morphs) infl.fill(0)

    const seed = (obj, axis, want) => {
      if (!obj) return
      for (const k of Object.keys(obj.userData)) {
        if (k.startsWith('rot')) delete obj.userData[k]
      }
      obj.userData[`rot${axis}`] = (obj.userData[`base${axis}`] || 0) + want
    }
    seed(found.upperL, 'Z', -1.2)
    seed(found.upperR, 'Z', 1.2)
    seed(found.foreL, 'Z', -0.06)
    seed(found.foreR, 'Z', 0.06)
    return found
  }, [gltf.scene, morphs])

  const cur = useRef({})
  const aspect = useThree((st) => st.size.width / Math.max(1, st.size.height))
  // Narrow phone frames can't fit her spread wings: fold them back instead
  // of shrinking her, so face + body keep full presence. Continuous in
  // aspect (no pop at the threshold); desktop keeps the full spread.
  const foldBase = aspect >= 1.68 ? 0.35 : 0.35 + Math.min(0.85, (1.68 - aspect) * 1.54)
  const blinkAt = useRef(2.5)
  const vowelAt = useRef(0)
  const vowelIdx = useRef(0)
  const vbMouthOpen = useRef(false)
  const elapsed = useRef(0)
  const talkMix = useRef(0)
  const talkTime = useRef(0)
  const prevBoost = useRef(0)
  const okaySince = useRef(-1)
  const walkT = useRef(0)
  const arriveT = useRef(null)
  // Time since the current mood became active: drives the wave-then-
  // behind-back sequence in good/great (replays on reselect).
  const moodSince = useRef(-1)
  const lastMoodKey = useRef(null)
  const postTalkAt = useRef(-1)
  const wasTalking = useRef(false)
  // First-frame flag (see kp below): bones snap straight to the mood pose
  // on mount instead of sweeping up from the bind pose.
  const snappedRef = useRef(false)
  const tears = useRef(initTears())
  const tearSprites = useRef([])
  const tearTex = useMemo(() => makeTearTexture(), [])
  const tearSpawnNext = useRef(0)
  const tearVec = useRef(new Vector3())

  // Light brown skin tone multiplier
  useMemo(() => {
    gltf.scene.traverse((obj) => {
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : []
      for (const m of mats) {
        if (m && /_SKIN/i.test(m.name || '') && m.color) m.color.set(0xdbb08c)
      }
    })
  }, [gltf.scene])

  // Wings alpha keying
  const [wingBase, setWingBase] = useState(null)
  useEffect(() => {
    let on = true
    new TextureLoader().load(
      '/models/wings.jpg',
      (t) => {
        try {
          const img = t.image
          const scale = Math.min(1, 1024 / img.width)
          const cw = Math.max(2, Math.round(img.width * scale))
          const ch = Math.max(2, Math.round(img.height * scale))
          const cv = document.createElement('canvas')
          cv.width = cw
          cv.height = ch
          const ctx = cv.getContext('2d')
          ctx.drawImage(img, 0, 0, cw, ch)
          const d = ctx.getImageData(0, 0, cw, ch)
          const px = d.data
          for (let i = 0; i < px.length; i += 4) {
            const m = Math.min(px[i], px[i + 1], px[i + 2])
            if (m > 238) px[i + 3] = 0
            else if (m > 212) px[i + 3] = Math.round((255 * (238 - m)) / 26)
          }
          const alpha = new Uint8Array(cw * ch)
          for (let p = 0; p < cw * ch; p++) alpha[p] = px[p * 4 + 3]
          for (let y = 0; y < ch; y++) {
            for (let x = 0; x < cw; x++) {
              const p = y * cw + x
              if (alpha[p] === 0) continue
              const edge =
                (x > 0 && alpha[p - 1] === 0) ||
                (x < cw - 1 && alpha[p + 1] === 0) ||
                (y > 0 && alpha[p - cw] === 0) ||
                (y < ch - 1 && alpha[p + cw] === 0)
              if (edge) px[p * 4 + 3] = 0
            }
          }
          ctx.putImageData(d, 0, 0)
          const ct = new CanvasTexture(cv)
          ct.colorSpace = SRGBColorSpace
          if (on) setWingBase(ct)
        } catch {
          // keep wings hidden rather than showing white boxes
        }
      },
      undefined,
      () => { },
    )
    return () => {
      on = false
    }
  }, [])

  const texL = useMemo(() => {
    if (!wingBase) return null
    const t = wingBase.clone()
    t.repeat.set(0.52, 1)
    t.offset.set(0, 0)
    t.needsUpdate = true
    return t
  }, [wingBase])

  const texR = useMemo(() => {
    if (!wingBase) return null
    const t = wingBase.clone()
    t.repeat.set(0.52, 1)
    t.offset.set(0.48, 0)
    t.needsUpdate = true
    return t
  }, [wingBase])

  const softTex = useMemo(() => makeSoftTexture(), [])

  useFrame((_, dt) => {
    const t = (elapsed.current += Math.min(dt, 0.05))
    const key = moodFiveKey(mood)
    const talkingRaw = isSpeaking()
    if (talkingRaw) talkTime.current += dt
    else talkTime.current = 0
    // Failsafe only: greetings run long (sad/very_bad files exceed 30s),
    // so this must outlive any real take and only catch a stuck flag.
    const talking = talkingRaw && talkTime.current < 120
    talkMix.current += ((talking ? 1 : 0) - talkMix.current) * (1 - Math.exp(-dt * 4))
    const talkAmt = talkMix.current
    // Live vocal energy for expression + mouth (null on TTS/silence).
    const voiceLevel = talking ? getVoiceLevel() : null
    const speechBoost = voiceLevel === null ? 0 : voiceLevel
    // Post-talk: look at camera for ~2.5s after speaking ends
    if (wasTalking.current && !talking) postTalkAt.current = t
    wasTalking.current = talking
    const postTalkSince = postTalkAt.current < 0 ? 999 : t - postTalkAt.current
    const postTalkLook = Math.max(0, 1 - postTalkSince / 2.5)
    const goal = { ...(EMOTION_TARGETS[key] || {}) }
    if (lastMoodKey.current !== key) {
      lastMoodKey.current = key
      moodSince.current = t
    }
    const msa = t - moodSince.current

    blinkAt.current -= dt
    if (blinkAt.current <= 0) blinkAt.current = key === 'verybad' ? 1.6 + Math.random() * 1.4 : 2.2 + Math.random() * 2.5
    // She blinks at phrase boundaries like people do: loud -> quiet.
    if (talking && prevBoost.current > 0.35 && speechBoost < 0.12) blinkAt.current = Math.min(blinkAt.current, 0.05)
    prevBoost.current = speechBoost
    const blinking = blinkAt.current < 0.12 ? 1 : 0

    let worryUp = 0
    if (key === 'verybad') {
      const cyc = t % 7
      const sstep = (a, b, x) => {
        const p = Math.min(1, Math.max(0, (x - a) / (b - a)))
        return p * p * (3 - 2 * p)
      }
      // worryUp ranges from 0 (behind back) to 1 (praying)
      worryUp = sstep(2.5, 3.5, cyc) * (1 - sstep(5.5, 6.5, cyc))
      goal.Fcl_ALL_Sorrow = 0.7 - worryUp * 0.12
      goal.Fcl_EYE_Sorrow = 0.8 - worryUp * 0.25
      goal.Fcl_EYE_Surprised = 0.08 + worryUp * 0.3
      goal.Fcl_ALL_Surprised = 0.05
      goal.Fcl_BRW_Sorrow = 0.85 - worryUp * 0.2
      goal.Fcl_BRW_Surprised = worryUp * 0.35
      goal.Fcl_EYE_Close = 0.14 - worryUp * 0.12
    }

    vowelAt.current -= dt
    if (talking && vowelAt.current <= 0) {
      vowelAt.current = 0.11 + Math.random() * 0.06
      if (key === 'verybad') vbMouthOpen.current = !vbMouthOpen.current
      else vowelIdx.current = (vowelIdx.current + 1 + Math.floor(Math.random() * 2)) % MOUTH_VOWELS.length
    }
    const activeVowel = talking && key !== 'verybad' ? MOUTH_VOWELS[vowelIdx.current] : null
    // Real loudness when file audio drives her voice (null for TTS/silence):
    // scale the mouth by it so pauses shut her mouth and loud parts open
    // wide, instead of flapping on a fixed timer the whole take.
    const openScale = voiceLevel === null ? 1 : 0.15 + 0.85 * voiceLevel

    // Enhanced lip-sync: separate, faster easing for the mouth to prevent lag
    const k_body = 1 - Math.exp(-dt * 10)
    const k_mouth = 1 - Math.exp(-dt * 18)

    // Post-talk: eyes open wide (dilat) for 2.5s after speaking ends
    // Also force mouth shut so she doesn't stay nakanganga
    if (postTalkLook > 0) {
      goal.Fcl_EYE_Close = 0
      goal.Fcl_EYE_Surprised = postTalkLook * 0.35
      for (const v of MOUTH_VOWELS) goal[v] = 0
      goal.Fcl_MTH_Joy = (goal.Fcl_MTH_Joy || 0) * (1 - postTalkLook)
      goal.Fcl_MTH_Fun = (goal.Fcl_MTH_Fun || 0) * (1 - postTalkLook)
    }

    // Speech-driven expression: brows lift and lids widen with her vocal
    // energy (scaled per mood so sad stays heavy-lidded). TTS contributes
    // nothing — static mood face, as before.
    const expressK = { great: 1.0, good: 0.8, okay: 0.6, sad: 0.35, verybad: 0.25 }[key] || 0.5
    if (talking && voiceLevel !== null) {
      goal.Fcl_BRW_Surprised = (goal.Fcl_BRW_Surprised || 0) + speechBoost * 0.25 * expressK
      if (key !== 'sad' && key !== 'verybad') {
        goal.Fcl_EYE_Surprised = (goal.Fcl_EYE_Surprised || 0) + speechBoost * 0.12 * expressK
      }
    }

    for (const name of ALL_MORPH_NAMES) {
      let want = goal[name] || 0
      const isMouth = MOUTH_TARGETS.has(name)
      if (isMouth) {
        if (key === 'verybad') {
          if (name === 'Fcl_MTH_A') want = talking && vbMouthOpen.current ? 0.6 * openScale : 0
          else if (name === 'Fcl_MTH_Angry') want = talking ? (vbMouthOpen.current ? 0.12 : 0.56) * openScale : 0.44
          else want = (goal[name] || 0) * 0.25
        } else {
          want = name === activeVowel ? 0.85 * openScale : (goal[name] || 0) * 0.25
        }
      }
      if (name === 'Fcl_EYE_Close') want = Math.max(blinking, goal[name] || 0)
      const prev = cur.current[name] || 0
      const next = prev + (want - prev) * (isMouth ? k_mouth : k_body)
      cur.current[name] = next
      setMorph(morphs, name, next)
    }

    walkT.current = Math.min(1, walkT.current + dt / 1.2)
    const wp = walkT.current
    const walkEase = 1 - Math.pow(1 - wp, 3)
    const backOut = (p) => {
      const c1 = 0.7
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
    }
    // Intro starts near full size (0.7) and close by: the old tiny-and-far
    // start (0.35 scale + 1.4 back) read as broken/empty on open.
    const popScale = 0.7 + 0.3 * Math.min(1.01, Math.max(0, backOut(wp)))
    const walking = wp < 1
    if (wp >= 1 && arriveT.current === null) arriveT.current = t

    if (key === 'okay') {
      if (okaySince.current < 0) okaySince.current = t
    } else {
      okaySince.current = -1
    }
    const waveClock = Math.max(okaySince.current, arriveT.current === null ? t : arriveT.current)
    const osa = t - waveClock

    if (group.current) {
      group.current.position.z = -0.5 * (1 - walkEase)
      group.current.position.y =
        GROUP_Y +
        Math.sin(t * 1.6) * 0.03 * walkEase +
        talkAmt * Math.sin(t * 4) * 0.008
      // Settled slightly below full size: 1.0 demonstrably overflows the
      // frame while 0.85 leaves it lost in empty space. Entrance grows into
      // it smoothly. 1.04 keeps her big and close with the wings fitting
      // via the mobile fold.
      group.current.scale.setScalar((walking ? popScale : 1) * 1.04)
      group.current.rotation.y = -0.45 * (1 - walkEase) + Math.sin(t * 0.5) * 0.12 * walkEase
      group.current.rotation.z = talkAmt * Math.sin(t * 3.5) * 0.01
    }

    // Recording: gentle wing flutter (not frantic). Speaking: fast flap.
    // On narrow screens a full-strength flap would periodically unfold her
    // tucked wings past the frame edge again, so it damps with the fold.
    const flapSpeed = recording ? 3.2 : 2.4
    const flapAmp = recording ? 0.32 : 0.28
    const flapDamp = Math.max(0.45, 1 - (foldBase - 0.35) * 0.9)
    const flap = Math.sin(t * flapSpeed) * flapAmp * flapDamp
    if (wingL.current) wingL.current.rotation.y = foldBase - flap
    if (wingR.current) wingR.current.rotation.y = -foldBase + flap

    const flapPulse = Math.abs(Math.cos(t * flapSpeed))
    if (glowLMat.current) glowLMat.current.opacity = 0.38 + flapPulse * 0.22
    if (glowRMat.current) glowRMat.current.opacity = 0.38 + flapPulse * 0.22
    if (rimLMat.current) rimLMat.current.opacity = 0.6 + flapPulse * 0.3
    if (rimRMat.current) rimRMat.current.opacity = 0.6 + flapPulse * 0.3

    // Enhanced organic movements: Compound sine waves to break robotic loops
    const talkSway = talkAmt * (Math.sin(t * 3.5) * 0.03 + Math.sin(t * 1.7) * 0.02)
    const idleNod = (Math.pow(Math.max(0, Math.sin(t * 0.85)), 8) * 0.03) + (Math.sin(t * 0.3) * 0.015)
    // Attentive listening nod: while the USER records, she nods along in
    // every mood (like the very-bad nod) so she visibly listens instead of
    // freezing. Folded into headBob so all five branches inherit it at once.
    const listenNod = recording ? Math.pow(Math.max(0, Math.sin(t * 1.6)), 4) * 0.08 : 0
    const headBob = talkAmt * (Math.sin(t * 4.5) * 0.01 + Math.sin(t * 3.1) * 0.008) + listenNod
    // Visible recording nod: sharp down-up dip while the user is speaking.
    // pow(sin, 6) keeps head at neutral most of the time, then dips cleanly.
    const recNod = recording ? Math.pow(Math.max(0, Math.sin(t * 1.3)), 6) * 0.22 : 0

    const nodGood = Math.pow(Math.max(0, Math.sin(t * 1.4)), 6)
    const nodOkay = Math.pow(Math.max(0, Math.sin(t * 0.7)), 8)
    const comfort = (Math.sin(t * 0.6) + 1) / 2
    // Easing up from the bind pose sweeps the arms through a broken-looking
    // raise on every open, so the first frame snaps instead. Morphs still
    // ease in — a face fading in reads as materializing.
    const kp = snappedRef.current ? 1 - Math.exp(-dt * 7) : 1

    const aim = (bone, axis, want) => {
      if (!bone) return
      const base = bone.userData[`base${axis}`] || 0
      const prop = `rot${axis}`
      const prev = bone.userData[prop] ?? base
      const next = prev + (base + want - prev) * kp
      bone.userData[prop] = next
      bone.rotation[axis.toLowerCase()] = next
    }

    // Corrected curl: ina-apply yung offset per buong daliri
    const curl = (list, v) => {
      (list || []).forEach((b) => {
        let offset = 0;
        const n = String(b.name || '');
        if (n.includes('Middle')) offset = 0.04;
        else if (n.includes('Ring')) offset = 0.08;
        else if (n.includes('Little')) offset = 0.12;
        aim(b, FINGER_AXIS, FINGER_SIGN * (v + offset));
      });
    }

    if (key === 'great') {
      // Bright happy face: arms relaxed at sides, head tilts side to side.
      const headTilt = Math.sin(t * 0.55) * 0.07
      aim(bones.chest, 'X', -0.06)
      aim(bones.head, 'X', -0.07 + headBob + idleNod + recNod)
      aim(bones.head, 'Y', Math.sin(t * 0.75) * 0.05)
      aim(bones.head, 'Z', headTilt)
      // Arms behind the back — hidden by body/wings on all screen sizes
      aim(bones.upperL, 'X', 1)
      aim(bones.upperL, 'Y', -1.2)
      aim(bones.upperL, 'Z', walking ? -0.9 : -1.0)
      aim(bones.foreL, 'Z', -0.4 + talkSway)
      aim(bones.handL, 'Y', -1.2)
      aim(bones.handL, 'Z', 0)
      aim(bones.upperR, 'X', 1)
      aim(bones.upperR, 'Y', 1.2)
      aim(bones.upperR, 'Z', walking ? 0.9 : 1.0)
      aim(bones.foreR, 'Z', -0.4 - talkSway)
      aim(bones.handR, 'Y', 1.2)
      aim(bones.handR, 'Z', 0)
      curl(bones.fingersL, 0.6)
      curl(bones.fingersR, 0.6)
      curl(bones.thumbsL, 0.35)
      curl(bones.thumbsR, 0.35)
    } else if (key === 'good') {
      // Happy closed-eye smile: arms relaxed at sides.
      aim(bones.chest, 'X', -0.03)
      aim(bones.head, 'X', nodGood * 0.12 + headBob + idleNod + recNod)
      aim(bones.head, 'Y', Math.sin(t * 0.7) * 0.04)
      aim(bones.head, 'Z', Math.sin(t * 0.55) * 0.05)
      // Arms behind the back — hidden by body/wings on all screen sizes
      aim(bones.upperL, 'X', 1)
      aim(bones.upperL, 'Y', -1.2)
      aim(bones.upperL, 'Z', walking ? -0.9 : -1.0)
      aim(bones.foreL, 'Z', -0.4 + talkSway)
      aim(bones.handL, 'Y', -1.2)
      aim(bones.handL, 'Z', 0)
      aim(bones.upperR, 'X', 1)
      aim(bones.upperR, 'Y', 1.2)
      aim(bones.upperR, 'Z', walking ? 0.9 : 1.0)
      aim(bones.foreR, 'Z', -0.4 - talkSway)
      aim(bones.handR, 'Y', 1.2)
      aim(bones.handR, 'Z', 0)
      curl(bones.fingersL, 0.6)
      curl(bones.fingersR, 0.6)
      curl(bones.thumbsL, 0.35)
      curl(bones.thumbsR, 0.35)
    } else if (key === 'sad') {
      // 8-second cycle: sad → look at camera → smile flash → back to sad
      const sadCyc = t % 8
      const sstep = (a, b, x) => {
        const p = Math.min(1, Math.max(0, (x - a) / (b - a)))
        return p * p * (3 - 2 * p)
      }
      const lookUp = sstep(2.5, 3.2, sadCyc) * (1 - sstep(5.2, 6.0, sadCyc))
      const smileFlash = sstep(3.4, 4.1, sadCyc) * (1 - sstep(4.6, 5.4, sadCyc))

      // Eyes: slightly heavy but open enough to show brown eyes, clears up when smiling
      goal.Fcl_EYE_Close = (0.08 + Math.sin(t * 0.55) * 0.04) * (1 - smileFlash * 0.9)
      goal.Fcl_EYE_Sorrow = (0.35 + Math.sin(t * 0.3) * 0.06) * (1 - smileFlash * 0.95)
      goal.Fcl_BRW_Sorrow = (0.6 + Math.sin(t * 0.4) * 0.08) * (1 - smileFlash * 0.8)
      // Smile flash morphs
      goal.Fcl_ALL_Joy = smileFlash * 0.45
      goal.Fcl_MTH_Joy = smileFlash * 0.55
      goal.Fcl_BRW_Joy = smileFlash * 0.3

      aim(bones.chest, 'X', 0.08 - lookUp * 0.06)
      // Stronger nod: pow(sin) gives sharp dips
      const sadNod = Math.pow(Math.max(0, Math.sin(t * 0.9)), 6) * 0.18
      aim(bones.head, 'X', (0.04 + sadNod + headBob) * (1 - lookUp * 0.95))
      aim(bones.head, 'Y', Math.sin(t * 0.38) * 0.09 * (1 - lookUp))
      // Eyes: keep gaze natural (no cross-eyed rotation)
      aim(bones.eyeL, 'X', 0)
      aim(bones.eyeR, 'X', 0)
      aim(bones.head, 'Z', (0.08 + Math.sin(t * 0.45) * 0.04) * (1 - lookUp * 0.7))
      aim(bones.upperL, 'X', 1)
      aim(bones.upperL, 'Y', -1.2)
      aim(bones.upperR, 'X', 1)
      aim(bones.upperR, 'Y', 1.2)
      aim(bones.handL, 'Y', -1.2)
      aim(bones.handR, 'Y', 1.2)
      aim(bones.upperL, 'Z', walking ? -0.9 : -0.75)
      aim(bones.upperR, 'Z', walking ? 0.9 : 0.75)
      aim(bones.foreL, 'Z', 0.5 + comfort * 0.12 + talkSway)
      aim(bones.foreR, 'Z', -(0.5 + comfort * 0.12) - talkSway)
      curl(bones.fingersL, 0.06)
      curl(bones.fingersR, 0.06)
      curl(bones.thumbsL, 0.06)
      curl(bones.thumbsR, 0.06)
    } else if (key === 'verybad') {
      const headShake = (1 - worryUp) * Math.sin(t * 2.5) * 0.12
      const heavyBreath = Math.sin(t * 0.8) * 0.015
      // Shy dip: while talking she bows a touch deeper, hands stay back.
      const shyBow = talkAmt * 0.04
      aim(bones.chest, 'X', 0.15 + heavyBreath - worryUp * 0.08)
      aim(bones.head, 'X', 0.35 + headBob - worryUp * 0.45 + shyBow)
      aim(bones.head, 'Y', headShake)
      aim(bones.head, 'Z', 0.08 + Math.sin(t * 1.1) * 0.02)

      // Hands stay hidden behind her back the whole time - the praying phase
      // is removed. worryUp still drives the face above (sad -> worried
      // eyes) and the head lift, only the arms are locked back here.
      // Left arm (deep behind-back values — hands fully hidden)
      aim(bones.upperL, 'X', 1)
      aim(bones.upperL, 'Y', -1.2)
      aim(bones.upperL, 'Z', walking ? -0.9 : -1.0)
      aim(bones.foreL, 'Z', -0.4 + talkSway)
      aim(bones.handL, 'Y', -1.2)
      aim(bones.handL, 'Z', 0)

      // Right arm (mirrored, deep behind-back)
      aim(bones.upperR, 'X', 1)
      aim(bones.upperR, 'Y', 1.2)
      aim(bones.upperR, 'Z', walking ? 0.9 : 1.0)
      aim(bones.foreR, 'Z', -0.4 - talkSway)
      aim(bones.handR, 'Y', 1.2)
      aim(bones.handR, 'Z', 0)

      // Fingers loosely folded behind her back
      curl(bones.fingersL, 0.6)
      curl(bones.fingersR, 0.6)
      curl(bones.thumbsL, 0.35)
      curl(bones.thumbsR, 0.35)

    } else {
      // Okay: arms behind the back — hidden by body/wings on all screen sizes.
      aim(bones.chest, 'X', 0.01)
      aim(bones.head, 'X', nodOkay * 0.08 + headBob + idleNod + recNod)
      aim(bones.head, 'Y', Math.sin(t * 0.35) * 0.06)
      aim(bones.head, 'Z', 0.03 + Math.sin(t * 0.9) * 0.03)
      aim(bones.upperL, 'X', 1)
      aim(bones.upperL, 'Y', -1.2)
      aim(bones.upperL, 'Z', walking ? -0.9 : -1.0)
      aim(bones.foreL, 'Z', -0.4 + talkSway)
      aim(bones.handL, 'Y', -1.2)
      aim(bones.handL, 'Z', 0)
      aim(bones.upperR, 'X', 1)
      aim(bones.upperR, 'Y', 1.2)
      aim(bones.upperR, 'Z', walking ? 0.9 : 1.0)
      aim(bones.foreR, 'Z', -0.4 - talkSway)
      aim(bones.handR, 'Y', 1.2)
      aim(bones.handR, 'Z', 0)
      curl(bones.fingersL, 0.6)
      curl(bones.fingersR, 0.6)
      curl(bones.thumbsL, 0.35)
      curl(bones.thumbsR, 0.35)
    }

    // Very Bad skips the drift so her hands go straight behind her back from
    // the first frame instead of dangling in front during the entrance.
    if (walking && key !== 'verybad') {
      const sway = Math.sin(t * 2.2) * 0.06
      aim(bones.upperL, 'Z', -1.05 + sway)
      aim(bones.upperR, 'Z', 1.05 + sway)
    }

    // Post-talk: smoothly face camera after speaking ends (routed through
    // aim so easing stays consistent instead of snapping bone values).
    if (postTalkLook > 0 && bones.head) {
      const hx = bones.head.userData.rotX ?? bones.head.userData.baseX ?? 0
      const hy = bones.head.userData.rotY ?? bones.head.userData.baseY ?? 0
      aim(bones.head, 'X', hx * (1 - postTalkLook * 0.88))
      aim(bones.head, 'Y', hy * (1 - postTalkLook))
    }
    if (postTalkLook > 0) {
      aim(bones.eyeL, 'X', 0)
      aim(bones.eyeR, 'X', 0)
    }

    // ---- Teary eyes for sad / verybad ----
    snappedRef.current = true
    const wantTears = key === 'sad' || key === 'verybad'
    if (wantTears && bones.eyeL && bones.eyeR && t > tearSpawnNext.current) {
      const interval = key === 'verybad'
        ? 0.5 + Math.random() * 0.8
        : 1.1 + Math.random() * 1.4
      tearSpawnNext.current = t + interval
      const free = tears.current.find((d) => !d.active)
      if (free) {
        const bone = Math.random() > 0.5 ? bones.eyeL : bones.eyeR
        bone.updateWorldMatrix(true, false)
        bone.getWorldPosition(tearVec.current)
        free.active = true
        free.x = tearVec.current.x + (Math.random() - 0.5) * 0.016
        free.y = tearVec.current.y - 0.012
        free.z = tearVec.current.z + 0.07
        free.vy = -(0.025 + Math.random() * 0.035)
        free.elapsed = 0
        free.maxLife = 1.0 + Math.random() * 0.9
        free.baseScale = 0.017 + Math.random() * 0.01
      }
    }
    tears.current.forEach((tear, i) => {
      const sp = tearSprites.current[i]
      if (!sp) return
      if (!tear.active) { sp.visible = false; return }
      tear.elapsed += dt
      tear.vy -= 0.18 * dt
      tear.y += tear.vy
      const life = tear.elapsed / tear.maxLife
      if (life >= 1) { tear.active = false; sp.visible = false; return }
      const fade = Math.sin(life * Math.PI)
      const s = tear.baseScale * (1 + life * 0.45)
      sp.visible = true
      sp.position.set(tear.x, tear.y, tear.z)
      sp.scale.set(s, s * 1.65, 1)
      sp.material.opacity = fade * 0.84
    })
  })

  return (
    <group ref={group} position={[0, GROUP_Y, 0]}>
      <primitive object={gltf.scene} />
      {Array.from({ length: TEAR_MAX }, (_, i) => (
        <sprite key={`tear-${i}`} ref={(el) => { tearSprites.current[i] = el }} visible={false}>
          <spriteMaterial map={tearTex} transparent depthWrite={false} opacity={0} />
        </sprite>
      ))}
      <group position={[0, 1.18, -0.38]}>
        <group ref={wingL} position={[-0.06, 0, 0]}>
          <mesh position={[-0.36, 0.06, 0]} visible={!!texL}>
            <planeGeometry args={[0.72, 0.62]} />
            <meshBasicMaterial map={texL} transparent side={2} depthWrite={false} opacity={0.92} color={wingTint} />
          </mesh>
          <mesh position={[-0.36, 0.06, -0.015]} scale={1.12} visible={!!texL}>
            <planeGeometry args={[0.72, 0.62]} />
            <meshBasicMaterial ref={rimLMat} map={texL} transparent side={2} depthWrite={false} opacity={0.65} color="#cf7bff" />
          </mesh>
          <sprite position={[-0.36, 0.06, -0.04]} scale={[1.5, 1.25, 1]}>
            <spriteMaterial ref={glowLMat} map={softTex} color="#cf9bff" transparent opacity={0.38} depthWrite={false} />
          </sprite>
        </group>
        <group ref={wingR} position={[0.06, 0, 0]}>
          <mesh position={[0.36, 0.06, 0]} visible={!!texR}>
            <planeGeometry args={[0.72, 0.62]} />
            <meshBasicMaterial map={texR} transparent side={2} depthWrite={false} opacity={0.92} color={wingTint} />
          </mesh>
          <mesh position={[0.36, 0.06, -0.015]} scale={1.12} visible={!!texR}>
            <planeGeometry args={[0.72, 0.62]} />
            <meshBasicMaterial ref={rimRMat} map={texR} transparent side={2} depthWrite={false} opacity={0.65} color="#cf7bff" />
          </mesh>
          <sprite position={[0.36, 0.06, -0.04]} scale={[1.5, 1.25, 1]}>
            <spriteMaterial ref={glowRMat} map={softTex} color="#cf9bff" transparent opacity={0.38} depthWrite={false} />
          </sprite>
        </group>
      </group>
    </group>
  )
}

const DUST_COUNT = 110
function dustRand(i, salt) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}
function makeDustSeeds() {
  return Array.from({ length: DUST_COUNT }, (_, i) => ({
    r: 0.3 + dustRand(i, 1) * 0.75,
    a: dustRand(i, 2) * Math.PI * 2,
    y: -0.9 + dustRand(i, 3) * 1.9,
    spin: 0.6 + dustRand(i, 4) * 1.4,
    rise: 0.18 + dustRand(i, 5) * 0.4,
  }))
}
function makeSoftTexture() {
  const S = 64
  const data = new Uint8Array(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x / (S - 1)) * 2 - 1
      const dy = (y / (S - 1)) * 2 - 1
      const d = Math.sqrt(dx * dx + dy * dy)
      const a = Math.max(0, 1 - d)
      const i = (y * S + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = Math.round(Math.pow(a, 1.8) * 255)
    }
  }
  const tex = new DataTexture(data, S, S)
  tex.needsUpdate = true
  return tex
}
const TEAR_MAX = 6
function makeTearTexture() {
  const S = 32
  const data = new Uint8Array(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = (x / (S - 1)) * 2 - 1
      // cy: -1 = top (near eye), +1 = bottom (pointed falling tip)
      const cy = (y / (S - 1)) * 2 - 1
      // Squeeze sides as cy increases → teardrop point at bottom
      const squeeze = 1 + Math.max(0, cy) * 2.2
      const d = Math.sqrt((cx * squeeze) ** 2 + cy ** 2)
      const a = Math.max(0, 1 - d)
      const i = (y * S + x) * 4
      data[i] = 160; data[i + 1] = 210; data[i + 2] = 255
      data[i + 3] = Math.round(Math.pow(a, 1.2) * 215)
    }
  }
  const tex = new DataTexture(data, S, S)
  tex.needsUpdate = true
  return tex
}
function initTears() {
  return Array.from({ length: TEAR_MAX }, () => ({
    active: false, x: 0, y: 0, z: 0, vy: 0, elapsed: 0, maxLife: 0, baseScale: 0.022,
  }))
}
function writeDustPositions(geo, seeds, t) {
  const pos = geo.attributes.position
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]
    const ang = s.a + t * s.spin
    const y = -0.9 + ((s.y + 0.9 + t * s.rise) % 2.1)
    pos.setXYZ(i, Math.cos(ang) * s.r, y, Math.sin(ang) * s.r * 0.55)
  }
  pos.needsUpdate = true
}
function FairyDust() {
  const ref = useRef(null)
  const seeds = useMemo(() => makeDustSeeds(), [])
  // Soft round sprite: without a map, points render as hard squares.
  const tex = useMemo(() => makeSoftTexture(), [])
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(DUST_COUNT * 3), 3))
    return g
  }, [])
  const t0 = useRef(-1)
  useFrame(({ clock }) => {
    if (t0.current < 0) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current
    writeDustPositions(geo, seeds, t)
    if (ref.current) {
      const fadeIn = Math.min(1, t * 3)
      const fadeOut = Math.max(0, 1 - (t - 2.2) / 1.2)
      ref.current.material.opacity = fadeIn * fadeOut * (0.65 + 0.35 * Math.sin(t * 9))
      ref.current.visible = fadeOut > 0
    }
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial map={tex} size={0.035} color="#ffd97a" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} sizeAttenuation />
    </points>
  )
}

class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('[Fairy3D] 3D fairy failed, showing 2D fallback:', error?.message || error)
  }

  render() {
    if (this.state.failed) {
      return <ButterflyFairy mood={this.props.mood} state="idle" variant={this.props.variant} />
    }
    return this.props.children
  }
}

function Fairy3D({ mood = 'okay', recording = false, variant = 'blossom' }) {
  // One framing everywhere: the responsive wing fold (see foldBase) fits
  // phone widths even at the desktop fov, so she stays big and close on
  // mobile too instead of shrinking into the distance.
  return (
    <div className="h-[280px] w-full sm:h-[340px]" style={{ animation: 'cymon-fairy-appear 1.2s ease-out' }}>
      {/* Fade-in on mount (replays every modal open): pairs with the 3D
        grow so she materializes smoothly instead of popping in. Opacity-only
        so it stays on the compositor and never janks the canvas. */}
      <style>{`@keyframes cymon-fairy-appear { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <ModelErrorBoundary mood={mood} variant={variant}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.65, 1.5], fov: 34 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ camera }) => camera.lookAt(...CAM_TARGET)}
        >
          <ambientLight intensity={0.55} color="#fff2e6" />
          <directionalLight position={[2, 4, 3]} intensity={1.15} />
          <directionalLight position={[-2, 1, 2]} intensity={0.35} color="#f9a8d4" />
          <Suspense fallback={null}>
            <FairyModel mood={mood} recording={recording} wingTint={WING_TINT[variant] || '#ffffff'} />
            <FairyDust />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  )
}

export default Fairy3D
