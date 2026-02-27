import os
import io
import re
import ast
import json
import time
import base64
import logging

log = logging.getLogger(__name__)

# ============================================================
# CONFIGURATION GLOBALE
# ============================================================
SAVE_DIR = "/config/www/pixoo_designer/pixoo_media"
TMP_DIR = SAVE_DIR
SAVE_DIR_GIF = "/config/www/pixoo_designer/pixoo_media_gif"
FONTS_JS_PATH = "/config/www/pixoo_designer/fonts.js"
PAGES_DIR = "/config/www/pixoo_designer/pages"


# ============================================================
# WORKER IO (THREAD SAFE / PYSCRIPT SAFE)
# ============================================================
@pyscript_compile
def _worker_io_task(action, data=None, filename=None, size=None):
    import requests
    from PIL import Image, ImageSequence

    if not os.path.exists(SAVE_DIR):
        try:
            os.makedirs(SAVE_DIR, exist_ok=True)
            os.chmod(SAVE_DIR, 0o777)
        except Exception as e:
            return f"❌ CRITICAL: Impossible de créer dossier {SAVE_DIR}: {e}"

    gif_ok_sizes = {16, 32, 64}
    try:
        gif_size = int(size) if size is not None else 64
    except Exception:
        gif_size = 64
    if gif_size not in gif_ok_sizes:
        gif_size = 64

    try:
        # --- TEST ---
        if action == "test":
            test_file = os.path.join(SAVE_DIR, "test_write.txt")
            with open(test_file, "w") as f:
                f.write("Test Pyscript OK (Unified Backend)")
            return f"✅ SUCCÈS: Écriture réussie dans {test_file}"

        # --- DOWNLOAD & UPLOAD ---
        img_bytes = None
        src_url = None

        if action == "download":
            src_url = data
            r = requests.get(data, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
            r.raise_for_status()
            img_bytes = r.content

        elif action == "upload":
            if "," in data:
                data = data.split(",")[1]
            img_bytes = base64.b64decode(data)
        else:
            return f"❌ ERREUR: action inconnue '{action}'"

        if not img_bytes:
            return "❌ ERREUR: Données vides."

        # Détection GIF
        is_gif_header = len(img_bytes) >= 3 and img_bytes[:3] == b"GIF"
        filename_ext = (os.path.splitext(filename or "")[1] or "").lower()
        is_gif_by_name = (filename_ext == ".gif")
        is_gif_by_url = bool(src_url) and src_url.lower().split("?")[0].endswith(".gif")
        source_is_gif = is_gif_header or is_gif_by_name or is_gif_by_url

        img = Image.open(io.BytesIO(img_bytes))
        base_name = os.path.splitext(filename)[0] if filename else "pixoo_asset"

        try:
            resample = Image.Resampling.NEAREST if img.width < 32 else Image.Resampling.LANCZOS
        except Exception:
            resample = Image.NEAREST if img.width < 32 else Image.LANCZOS

        n_frames = int(getattr(img, "n_frames", 1) or 1)
        is_animated = bool(getattr(img, "is_animated", False)) or (n_frames >= 2)

        # SI C'EST UN GIF ANIMÉ -> SAUVEGARDE EN GIF
        if source_is_gif and is_animated:
            target_path = os.path.join(SAVE_DIR, f"{base_name}.gif")
            frames = []
            durations = []

            for frame in ImageSequence.Iterator(img):
                f = frame.convert("RGBA").resize((gif_size, gif_size), resample)
                alpha = f.split()[3]
                # palette + transparence index 255
                f = f.convert("RGB").convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
                mask = Image.eval(alpha, lambda a: 255 if a <= 128 else 0)
                f.paste(255, mask)
                frames.append(f)

                d = frame.info.get("duration", img.info.get("duration", 100))
                try:
                    d = int(d)
                except Exception:
                    d = 100
                durations.append(max(20, d))

            if len(frames) < 2:
                target_path = os.path.join(SAVE_DIR, f"{base_name}.png")
                out = img.convert("RGBA").resize((64, 64), resample)
                out.save(target_path, "PNG")
                return f"⚠️ SOURCE GIF MAIS PAS ANIMÉ -> PNG : {target_path}"

            frames[0].save(
                target_path, save_all=True, append_images=frames[1:],
                duration=durations, loop=0, transparency=255, disposal=2
            )
            return f"✅ SUCCÈS: GIF animé sauvegardé -> {target_path}"

        # SINON -> PNG
        target_path = os.path.join(SAVE_DIR, f"{base_name}.png")
        out = img.convert("RGBA").resize((64, 64), resample)
        out.save(target_path, "PNG")

        if source_is_gif and not is_animated:
            return f"⚠️ SOURCE GIF NON ANIMÉ -> PNG : {target_path}"
        return f"✅ SUCCÈS: PNG sauvegardé -> {target_path}"

    except Exception as e:
        return f"❌ EXCEPTION: {str(e)}"


# ============================================================
# WORKER CLEAN (⚠️ WIPE TOTAL)
# ============================================================
@pyscript_compile
def _worker_clean_media():
    import subprocess
    try:
        if not os.path.exists(SAVE_DIR):
            return f"✅ Rien à nettoyer: {SAVE_DIR} n'existe pas."
        if SAVE_DIR.strip() != "/config/www/pixoo_designer/pixoo_media":
            return f"❌ Sécurité: chemin inattendu: {SAVE_DIR}"

        before = subprocess.run(["sh", "-c", f"find '{SAVE_DIR}' -mindepth 1 2>/dev/null | wc -l"], capture_output=True, text=True)
        n_before = int((before.stdout or "0").strip() or "0")

        subprocess.run(["sh", "-c", f"chmod -R a+rwx '{SAVE_DIR}' 2>&1"], capture_output=True, text=True)
        subprocess.run(["sh", "-c", f"rm -rf '{SAVE_DIR}'/* '{SAVE_DIR}'/.[!.]* '{SAVE_DIR}'/..?* 2>&1"], capture_output=True, text=True)

        after = subprocess.run(["sh", "-c", f"find '{SAVE_DIR}' -mindepth 1 2>/dev/null | wc -l"], capture_output=True, text=True)
        n_after = int((after.stdout or "0").strip() or "0")

        return f"✅ CLEAN OK: supprimés={n_before - n_after}"
    except Exception as e:
        return f"❌ EXCEPTION CLEAN: {str(e)}"


# ============================================================
# SERVICES HOME ASSISTANT (async, sinon ça casse tout)
# ============================================================
@service
async def pixoo_test_write_permissions():
    res = await task.executor(_worker_io_task, "test")
    log.info(f"Pixoo Test: {res}")

@service
async def pixoo_upload_base64(base64_data=None, filename=None, size=None):
    if not base64_data or not filename:
        return
    res = await task.executor(_worker_io_task, "upload", base64_data, filename, size)
    log.info(f"Pixoo Upload: {res}")

@service
async def pixoo_download_url(url=None, filename=None, size=None):
    if not url or not filename:
        return
    res = await task.executor(_worker_io_task, "download", url, filename, size)
    log.info(f"Pixoo Download: {res}")

@service
async def pixoo_clean_pixoo_media(directory=None):
    res = await task.executor(_worker_clean_media)
    log.info(f"Pixoo Clean: {res}")


# ============================================================
# ✅ SERVICE "GIF PERMANENT" BASE64 -> pixoo_media_gif (atomic)
# ============================================================
@pyscript_compile
def _worker_write_gif_permanent_from_b64(base64_data, filename, size=16):
    from PIL import Image, ImageSequence

    os.makedirs(SAVE_DIR_GIF, exist_ok=True)
    try:
        os.chmod(SAVE_DIR_GIF, 0o777)
    except Exception:
        pass

    if "," in base64_data:
        base64_data = base64_data.split(",", 1)[1]

    raw = base64.b64decode(base64_data)
    img = Image.open(io.BytesIO(raw))

    try:
        s = int(size)
    except Exception:
        s = 16
    if s not in (8, 16, 32, 64):
        s = 16

    out_path = os.path.join(SAVE_DIR_GIF, filename)
    tmp_path = out_path + ".tmp.gif"  # IMPORTANT: finit par .gif pour Pillow

    n_frames = int(getattr(img, "n_frames", 1) or 1)
    is_animated = bool(getattr(img, "is_animated", False)) or (n_frames >= 2)

    if is_animated:
        frames = []
        durations = []
        for fr in ImageSequence.Iterator(img):
            rgba = fr.convert("RGBA").resize((s, s), resample=Image.NEAREST)

            alpha = rgba.split()[3]
            pal = rgba.convert("RGB").convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
            mask = Image.eval(alpha, lambda a: 255 if a <= 128 else 0)
            pal.paste(255, mask)

            d = fr.info.get("duration", img.info.get("duration", 100))
            try:
                d = int(d)
            except Exception:
                d = 100
            durations.append(max(20, d))
            frames.append(pal)

        frames[0].save(
            tmp_path,
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            transparency=255,
            disposal=2
        )
    else:
        rgba = img.convert("RGBA").resize((s, s), resample=Image.NEAREST)
        rgba.save(tmp_path, "GIF")

    os.replace(tmp_path, out_path)  # atomic

    try:
        os.chmod(out_path, 0o666)
    except Exception:
        pass

    return out_path

@service
async def pixoo_upload_gif_permanent_base64(base64_data=None, filename=None, size=16):
    if not base64_data or not filename:
        log.warning("pixoo_upload_gif_permanent_base64: base64_data/filename manquant")
        return
    try:
        out = await task.executor(_worker_write_gif_permanent_from_b64, base64_data, filename, size)
        log.info(f"✅ GIF permanent écrit: {out}")
        return out
    except Exception as e:
        log.error(f"❌ Erreur GIF permanent base64: {e}")
        return f"❌ {e}"


# ===========================================================
# ✅ BAKE MULTIGIF (manual)
# ===========================================================
@service
async def pixoo_bake_gif(recipe=None):
    if not recipe:
        log.warning("pixoo_bake_gif: recipe manquante")
        return

    if isinstance(recipe, str):
        try:
            recipe = json.loads(recipe)
        except Exception as e:
            log.error(f"❌ Forge à GIF: recette JSON invalide: {e}")
            return f"❌ JSON invalide: {e}"

    log.info("🔥 Forge à GIF: Cuisson démarrée !")

    sensor_data = {}
    for s in (recipe.get("sensors", []) or []):
        eid = (s or {}).get("entity_id")
        if not eid:
            continue
        try:
            st = hass.states.get(eid)
            val = st.state if st else None

            prec = (s or {}).get("precision", None)
            if prec is None:
                try:
                    val_str = str(round(float(val)))
                except Exception:
                    val_str = str(val)
            else:
                try:
                    prec = int(prec)
                    f = float(val)
                    val_str = f"{f:.{prec}f}"
                except Exception:
                    val_str = str(val)

            if (s or {}).get("show_unit"):
                try:
                    unit = st.attributes.get("unit_of_measurement") if st else None
                    if unit:
                        val_str += f" {unit}"
                except Exception:
                    pass

            sensor_data[eid] = val_str
        except Exception:
            sensor_data[eid] = "N/A"

    try:
        result = await task.executor(_worker_bake_task, recipe, sensor_data)
        log.info(f"✅ Forge à GIF: {result}")
        return result
    except Exception as e:
        log.error(f"❌ Forge à GIF: Erreur critique de cuisson - {e}")
        return f"❌ {e}"


@pyscript_compile
def _worker_bake_task(recipe, sensor_data):
    import re
    import ast
    from PIL import Image, ImageColor

    # ===========================================================
    # 0) Lecture polices depuis fonts.js
    # ===========================================================
    FONTS = {}
    try:
        if os.path.exists(FONTS_JS_PATH):
            with open(FONTS_JS_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            content = re.sub(r"//.*", "", content)
            content = re.sub(r"console\.log\(.*?\);", "", content)
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1:
                FONTS = ast.literal_eval(content[start : end + 1])
    except Exception:
        FONTS = {}

    if not FONTS:
        FONTS = {
            "PICO_8": {
                " ": [0,0,0,0,0,0,0,0,0,3],
                "?": [1,1,1,0,0,1,0,1,0,0,0,0,0,1,0,3],
            }
        }

    def draw_pixel_text(draw_img, text, x, y, color_hex, align, font_name):
        rgb = ImageColor.getrgb(color_hex)
        f_dict = FONTS.get(font_name, FONTS.get("PICO_8", {}))

        # largeur totale pour align
        total_w = 0
        for ch in text:
            # --- PATCH: gérer '-' même si la font ne l'a pas
            if ch == "-" and "-" not in f_dict:
                total_w += 4  # 3 px de trait + 1 espace
                continue

            glyph = f_dict.get(ch, f_dict.get(ch.upper(), f_dict.get("?", f_dict.get(" "))))
            total_w += (glyph[-1] if glyph else 3) + 1
        total_w = max(0, total_w - 1)

        start_x = x
        if align == "center":
            start_x = int((64 - total_w) / 2) + x
        elif align == "right":
            start_x = (64 - total_w) - x

        cx = start_x
        pixels = draw_img.load()

        for ch in text:
            # --- PATCH: dessiner '-' même si la font ne l'a pas
            if ch == "-" and "-" not in f_dict:
                py = y + 3  # ajuste 2/3/4 si tu veux le trait plus haut/bas
                for dx in range(3):
                    px = cx + dx
                    if 0 <= px < 64 and 0 <= py < 64:
                        pixels[px, py] = rgb + (255,)
                cx += 4  # 3 px + 1 espace
                continue

            glyph = f_dict.get(ch, f_dict.get(ch.upper(), f_dict.get("?", f_dict.get(" "))))
            if not glyph:
                continue
            w = glyph[-1]
            dots = glyph[:-1]
            for i, dot in enumerate(dots):
                if dot == 1:
                    px = cx + (i % w)
                    py = y + (i // w)
                    if 0 <= px < 64 and 0 <= py < 64:
                        pixels[px, py] = rgb + (255,)
            cx += w + 1

    # ===========================================================
    # 1) Fond
    # ===========================================================
    out_filename = recipe.get("output_file", "cuisson_finale.gif")
    out_path = os.path.join(SAVE_DIR_GIF, out_filename)

    bg_path_raw = recipe.get("background_gif", "") or ""
    bg_path = bg_path_raw if bg_path_raw.startswith("/config/www/") else bg_path_raw.replace("/local/", "/config/www/")

    frames = []
    durations = []

    if bg_path and os.path.exists(bg_path):
        bg_img = Image.open(bg_path)
        try:
            while True:
                frames.append(bg_img.convert("RGBA"))
                durations.append(bg_img.info.get("duration", 100))
                bg_img.seek(bg_img.tell() + 1)
        except EOFError:
            pass
    else:
        frames.append(Image.new("RGBA", (64, 64), (0, 0, 0, 255)))
        durations.append(100)

    # ===========================================================
    # 2) Animations (MultiGif) — on cherche d'abord dans TMP puis dans SAVE_DIR_GIF
    # ===========================================================
    loaded_anims = []
    anim_list = (recipe.get("animations", []) or recipe.get("multi_gif", []) or [])

    for anim in anim_list:
        if not anim:
            continue
        path = anim.get("path")
        if not path:
            continue  # ✅ évite le None.split()

        anim_filename = str(path).split("/")[-1]
        anim_path_tmp = os.path.join(TMP_DIR, anim_filename)
        anim_path_gif = os.path.join(SAVE_DIR_GIF, anim_filename)
        anim_path = anim_path_tmp if os.path.exists(anim_path_tmp) else anim_path_gif

        if not os.path.exists(anim_path):
            continue

        img = Image.open(anim_path)
        anim_frames = []
        try:
            while True:
                anim_frames.append(img.convert("RGBA"))
                img.seek(img.tell() + 1)
        except EOFError:
            pass

        if not anim_frames:
            continue

        tw = anim.get("w")
        th = anim.get("h")
        if tw and th:
            try:
                tw = int(tw); th = int(th)
                if tw > 0 and th > 0:
                    anim_frames = [fr.resize((tw, th), resample=Image.NEAREST) for fr in anim_frames]
            except Exception:
                pass

        loaded_anims.append({
            "frames": anim_frames,
            "x": int(anim.get("x", 0)),
            "y": int(anim.get("y", 0)),
            "count": len(anim_frames),
        })

    # ===========================================================
    # 3) Calque statique
    # ===========================================================
    static_layer_name = recipe.get("static_layer", "") or ""
    static_img = None
    if static_layer_name:
        static_path = os.path.join(TMP_DIR, static_layer_name)
        if os.path.exists(static_path):
            static_img = Image.open(static_path).convert("RGBA")

    # ===========================================================
    # 4) Timeline / master count
    # ===========================================================
    master_count = max(len(frames), max((a["count"] for a in loaded_anims), default=0), 1)

    if len(frames) < master_count:
        last = frames[-1].copy()
        frames = frames + [last.copy() for _ in range(master_count - len(frames))]
        last_d = durations[-1] if durations else 100
        durations = (durations or [100]) + [last_d for _ in range(master_count - len(durations or [100]))]

    if len(durations) < master_count:
        last_d = durations[-1] if durations else 100
        durations = durations + [last_d for _ in range(master_count - len(durations))]

    # ===========================================================
    # 5) Assemblage final
    # ===========================================================
    final_frames = []
    for i in range(master_count):
        base = frames[i].copy()

        for anim in loaded_anims:
            fr = anim["frames"][i % anim["count"]]
            base.paste(fr, (anim["x"], anim["y"]), fr)

        if static_img:
            base.paste(static_img, (0, 0), static_img)

        for s in (recipe.get("sensors", []) or []):
            eid = (s or {}).get("entity_id")
            val_str = sensor_data.get(eid, "N/A")
            draw_pixel_text(
                draw_img=base,
                text=str(val_str),
                x=int(s.get("x", 0)),
                y=int(s.get("y", 0)),
                color_hex=s.get("color", "#ffffff"),
                align=s.get("align", "left"),
                font_name=s.get("font", "PICO_8"),
            )

        final_frames.append(base)

    # ===========================================================
    # 6) Save
    # ===========================================================
    os.makedirs(SAVE_DIR_GIF, exist_ok=True)
    try:
        if os.path.exists(out_path):
            os.remove(out_path)
    except Exception:
        pass

    final_frames[0].save(
        out_path,
        save_all=True,
        append_images=final_frames[1:],
        loop=0,
        duration=durations,
        disposal=2,
    )

    try:
        os.chmod(out_path, 0o666)
    except Exception:
        pass

    return f"Cuisson OK: {out_path} (frames={master_count}, anims={len(loaded_anims)})"
    
# ===========================================================
# PAGE SAVE (json meta)
# ===========================================================
@pyscript_compile
def _worker_page_save(page_id, title, output_file, refresh_sec, enabled, recipe_json_str):
    os.makedirs(PAGES_DIR, exist_ok=True)
    try:
        os.chmod(PAGES_DIR, 0o777)
    except Exception:
        pass

    pid = str(page_id or "").strip()
    if not pid:
        raise ValueError("page_id manquant")

    out = str(output_file or "").strip()
    if not out:
        raise ValueError("output_file manquant")

    try:
        refresh_sec = int(refresh_sec)
    except Exception:
        refresh_sec = 60
    refresh_sec = max(10, refresh_sec)

    enabled = bool(enabled)

    try:
        recipe_obj = json.loads(recipe_json_str) if isinstance(recipe_json_str, str) else recipe_json_str
    except Exception as e:
        raise ValueError(f"recipe invalide (json): {e}")

    recipe_obj["output_file"] = out

    payload = {
        "page_id": pid,
        "title": str(title or ""),
        "output_file": out,
        "refresh_sec": refresh_sec,
        "enabled": enabled,
        "updated_at": int(time.time()),
        "recipe": recipe_obj,
    }

    path = os.path.join(PAGES_DIR, f"{pid}.json")
    tmp = path + ".tmp"

    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

    try:
        os.chmod(path, 0o666)
    except Exception:
        pass

    return path

@service
async def pixoo_page_save(page_id=None, title=None, output_file=None, refresh_sec=60, enabled=True, recipe=None):
    if not page_id or not recipe:
        log.warning("pixoo_page_save: page_id/recipe manquant")
        return
    try:
        out_path = await task.executor(_worker_page_save, page_id, title, output_file, refresh_sec, enabled, recipe)
        log.info(f"✅ Page sauvée: id={page_id} -> {out_path}")
        return out_path
    except Exception as e:
        log.error(f"❌ pixoo_page_save: {e}")
        return f"❌ {e}"


# ===========================================================
# DYNAMIC PAGES REFRESH
# ===========================================================
@pyscript_compile
def _worker_pages_list():
    os.makedirs(PAGES_DIR, exist_ok=True)
    out = []
    for fn in os.listdir(PAGES_DIR):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(PAGES_DIR, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["_path"] = path
            out.append(data)
        except Exception:
            pass
    return out

@pyscript_compile
def _worker_pages_write(meta_path, data_obj):
    os.makedirs(PAGES_DIR, exist_ok=True)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(data_obj, f, ensure_ascii=False, indent=2)
    try:
        os.chmod(meta_path, 0o666)
    except Exception:
        pass
    return meta_path

@service
async def pixoo_pages_refresh(force=False, limit=5):
    try:
        pages_list = await task.executor(_worker_pages_list)
    except Exception as e:
        log.error(f"❌ pixoo_pages_refresh: impossible de lister les pages: {e}")
        return

    now = int(time.time())
    baked = 0

    decorated = []
    i = 0
    for p in pages_list:
        try:
            refresh_sec = int(p.get("refresh_sec", 60) or 60)
            last_bake = int(p.get("last_bake", 0) or 0)
            late = (now - last_bake) - refresh_sec
        except Exception:
            late = 0
        decorated.append((late, i, p))
        i += 1

    decorated.sort(reverse=True)
    pages_list = [t[2] for t in decorated]

    for pmeta in pages_list:
        if baked >= int(limit or 5):
            break

        try:
            if not bool(pmeta.get("enabled", True)):
                continue

            refresh_sec = int(pmeta.get("refresh_sec", 60) or 60)
            refresh_sec = max(10, refresh_sec)

            last_bake = int(pmeta.get("last_bake", 0) or 0)
            due = bool(force) or ((now - last_bake) >= refresh_sec)
            if not due:
                continue

            recipe_raw = pmeta.get("recipe")
            if not recipe_raw:
                continue

            if isinstance(recipe_raw, str):
                try:
                    recipe = json.loads(recipe_raw)
                except Exception:
                    pmeta["last_error"] = "recipe JSON invalide"
                    pmeta["last_bake"] = now
                    await task.executor(_worker_pages_write, pmeta["_path"], pmeta)
                    continue
            else:
                recipe = recipe_raw

            out_file = (pmeta.get("output_file") or recipe.get("output_file") or "").strip()
            if not out_file:
                out_file = f"page_{pmeta.get('page_id','unknown')}.gif"
            recipe["output_file"] = out_file

            # sensor snapshot
            sensor_data = {}
            for s in (recipe.get("sensors", []) or []):
                eid = (s or {}).get("entity_id")
                if not eid:
                    continue
                try:
                    st = hass.states.get(eid)
                    val = st.state if st else None

                    prec = (s or {}).get("precision", None)
                    if prec is None:
                        try:
                            val_str = str(round(float(val)))
                        except Exception:
                            val_str = str(val)
                    else:
                        try:
                            prec = int(prec)
                            f = float(val)
                            val_str = f"{f:.{prec}f}"
                        except Exception:
                            val_str = str(val)

                    if (s or {}).get("show_unit"):
                        try:
                            unit = st.attributes.get("unit_of_measurement") if st else None
                            if unit:
                                val_str += f" {unit}"
                        except Exception:
                            pass

                    sensor_data[eid] = val_str
                except Exception:
                    sensor_data[eid] = "N/A"

            # debug meta
            try:
                pmeta["last_sensor_data"] = sensor_data
                pmeta["last_sensor_ts"] = now
                await task.executor(_worker_pages_write, pmeta["_path"], pmeta)
            except Exception:
                pass

            # bake
            frozen_sensor_data = dict(sensor_data)  # ✅ snapshot dur
            result = await task.executor(_worker_bake_task, recipe, frozen_sensor_data)

            # meta update
            pmeta["last_bake"] = now
            pmeta["last_error"] = ""
            pmeta["last_result"] = str(result)[:250]
            await task.executor(_worker_pages_write, pmeta["_path"], pmeta)

            baked += 1
            log.info(f"✅ Dynamic refresh: {pmeta.get('title','(no title)')} -> {out_file}")

        except Exception as e:
            try:
                pmeta["last_bake"] = now
                pmeta["last_error"] = str(e)[:250]
                await task.executor(_worker_pages_write, pmeta["_path"], pmeta)
            except Exception:
                pass
            log.error(f"❌ Dynamic refresh error: {e}")

    return {"baked": baked, "checked": len(pages_list), "force": bool(force), "limit": int(limit or 5)}
