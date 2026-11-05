// Built-in workflow presets, written in ComfyUI "API format".
// Each preset's build(p) returns a prompt graph: { nodeId: { class_type, inputs } }.
// Links are [nodeId, outputIndex].

export const NEGATIVE_VIDEO =
  "blurry, low quality, worst quality, jpeg artifacts, static, frozen, deformed, extra limbs, watermark, text, subtitles";
export const NEGATIVE_IMAGE =
  "blurry, low quality, worst quality, jpeg artifacts, deformed, watermark, text";

// Model files each preset expects, by ComfyUI loader + input name.
// Used to warn when a file is missing on the connected machine.
const WAN_TE = "umt5_xxl_fp8_e4m3fn_scaled.safetensors";
const WAN21_VAE = "wan_2.1_vae.safetensors";
const WAN22_VAE = "wan2.2_vae.safetensors";

function saveVideo(id, images, fps, prefix) {
  return {
    [id]: {
      class_type: "SaveAnimatedWEBP",
      inputs: { images, filename_prefix: prefix, fps, lossless: false, quality: 90, method: "default" },
    },
  };
}

function wanText(clipId, p) {
  return {
    pos: { class_type: "CLIPTextEncode", inputs: { text: p.prompt, clip: [clipId, 0] } },
    neg: { class_type: "CLIPTextEncode", inputs: { text: p.negative || NEGATIVE_VIDEO, clip: [clipId, 0] } },
  };
}

export const PRESETS = [
  // ---------------- Images ----------------
  {
    id: "txt2img",
    mode: "image",
    name: "Text → Image",
    tier: "home",
    note: "Any SD 1.5 / SDXL checkpoint. Great on a 6GB laptop GPU.",
    usesCheckpoint: true,
    defaults: { width: 1024, height: 1024, steps: 8, cfg: 2, sampler: "lcm", scheduler: "sgm_uniform" },
    sizes: [[1024, 1024], [832, 1216], [1216, 832], [768, 1344], [512, 512]],
    build(p) {
      return {
        ckpt: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: p.checkpoint } },
        pos: { class_type: "CLIPTextEncode", inputs: { text: p.prompt, clip: ["ckpt", 1] } },
        neg: { class_type: "CLIPTextEncode", inputs: { text: p.negative || NEGATIVE_IMAGE, clip: ["ckpt", 1] } },
        latent: { class_type: "EmptyLatentImage", inputs: { width: p.width, height: p.height, batch_size: p.batch || 1 } },
        sample: {
          class_type: "KSampler",
          inputs: {
            model: ["ckpt", 0], seed: p.seed, steps: p.steps, cfg: p.cfg,
            sampler_name: p.sampler, scheduler: p.scheduler,
            positive: ["pos", 0], negative: ["neg", 0], latent_image: ["latent", 0], denoise: 1,
          },
        },
        decode: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["ckpt", 2] } },
        save: { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: "studio/img" } },
      };
    },
  },
  {
    id: "img2img",
    mode: "edit",
    name: "Edit / Restyle Image",
    tier: "home",
    note: "Re-draws your photo following the prompt. Lower strength keeps more of the original.",
    usesCheckpoint: true,
    needsImage: true,
    defaults: { steps: 8, cfg: 2, sampler: "lcm", scheduler: "sgm_uniform", denoise: 0.55 },
    build(p) {
      return {
        ckpt: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: p.checkpoint } },
        load: { class_type: "LoadImage", inputs: { image: p.image } },
        scale: {
          class_type: "ImageScaleToTotalPixels",
          inputs: { image: ["load", 0], upscale_method: "lanczos", megapixels: 1.0, resolution_steps: 8 },
        },
        enc: { class_type: "VAEEncode", inputs: { pixels: ["scale", 0], vae: ["ckpt", 2] } },
        pos: { class_type: "CLIPTextEncode", inputs: { text: p.prompt, clip: ["ckpt", 1] } },
        neg: { class_type: "CLIPTextEncode", inputs: { text: p.negative || NEGATIVE_IMAGE, clip: ["ckpt", 1] } },
        sample: {
          class_type: "KSampler",
          inputs: {
            model: ["ckpt", 0], seed: p.seed, steps: p.steps, cfg: p.cfg,
            sampler_name: p.sampler, scheduler: p.scheduler,
            positive: ["pos", 0], negative: ["neg", 0], latent_image: ["enc", 0], denoise: p.denoise,
          },
        },
        decode: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["ckpt", 2] } },
        save: { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: "studio/edit" } },
      };
    },
  },

  // ---------------- Video ----------------
  {
    id: "wan21_1.3b",
    mode: "video",
    name: "Wan 2.1 1.3B · fast",
    tier: "home",
    note: "Runs on 6GB VRAM. 480p, ~2s clips. Expect several minutes per clip on an RTX 4050.",
    files: { UNETLoader: ["wan2.1_t2v_1.3B_fp16.safetensors"], CLIPLoader: [WAN_TE], VAELoader: [WAN21_VAE] },
    defaults: { width: 832, height: 480, frames: 33, fps: 16, steps: 25, cfg: 6 },
    sizes: [[832, 480], [480, 832], [624, 624]],
    build(p) {
      const t = wanText("clip", p);
      return {
        unet: { class_type: "UNETLoader", inputs: { unet_name: "wan2.1_t2v_1.3B_fp16.safetensors", weight_dtype: "default" } },
        clip: { class_type: "CLIPLoader", inputs: { clip_name: WAN_TE, type: "wan", device: "default" } },
        vae: { class_type: "VAELoader", inputs: { vae_name: WAN21_VAE } },
        shift: { class_type: "ModelSamplingSD3", inputs: { model: ["unet", 0], shift: 8 } },
        ...t,
        latent: { class_type: "EmptyHunyuanLatentVideo", inputs: { width: p.width, height: p.height, length: p.frames, batch_size: 1 } },
        sample: {
          class_type: "KSampler",
          inputs: {
            model: ["shift", 0], seed: p.seed, steps: p.steps, cfg: p.cfg, sampler_name: "uni_pc", scheduler: "simple",
            positive: ["pos", 0], negative: ["neg", 0], latent_image: ["latent", 0], denoise: 1,
          },
        },
        decode: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["vae", 0] } },
        ...saveVideo("save", ["decode", 0], p.fps, "studio/wan21"),
      };
    },
  },
  {
    id: "wan22_5b",
    mode: "video",
    name: "Wan 2