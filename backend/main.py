import os
import uuid
import zipfile
import shutil
import cv2
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Add CORS middleware to allow requests from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join("uploaded_videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CSV_UPLOAD_DIR = os.path.join("uploaded_csvs")
os.makedirs(CSV_UPLOAD_DIR, exist_ok=True)

ZIP_UPLOAD_DIR = os.path.join("uploaded_zips")
os.makedirs(ZIP_UPLOAD_DIR, exist_ok=True)

ZIP_PROCESS_DIR = os.path.join("zip_processing")
os.makedirs(ZIP_PROCESS_DIR, exist_ok=True)

# Global counter for screenshot folders
screenshot_counter = 1

@app.post("/upload")
async def upload_video(
    video: UploadFile = File(...),
    csv_file: UploadFile = File(...),
    title: str = Form("Untitled")
):
    global screenshot_counter

    try:
        # Save the uploaded video file with the original frontend filename
        video_path = os.path.join(UPLOAD_DIR, video.filename)
        with open(video_path, "wb") as buffer:
            content = await video.read()
            buffer.write(content)

        # Save the uploaded CSV file with the original frontend filename
        csv_path = os.path.join(CSV_UPLOAD_DIR, csv_file.filename)
        with open(csv_path, "wb") as buffer:
            content = await csv_file.read()
            buffer.write(content)

        # Create unique screenshots folder
        video_base = video.filename.rsplit('.', 1)[0]
        screenshots_dir = video_base
        output_dir = os.path.join("downloaded", screenshots_dir)
        os.makedirs(output_dir, exist_ok=True)
        screenshot_counter += 1

        # Load and filter CSV data from the uploaded CSV file
        df = pd.read_csv(csv_path)
        df = df[df["confidence"] > 0.5].reset_index(drop=True)
        df_final = df[df.groupby("track_id").cumcount() % 10 == 0].copy()
        df_final = df_final.reset_index(drop=True)
        df_final["uuid"] = list(range(1, len(df_final) + 1))

        # Sort by timestamp to minimize video seeking
        if "timestamp_seconds" in df_final.columns:
            df_final = df_final.sort_values("timestamp_seconds").reset_index(drop=True)
        elif "frame_number" in df_final.columns:
            df_final = df_final.sort_values("frame_number").reset_index(drop=True)

        # Save the filtered dataframe to CSV file with unique name
        csv_filename = f"{video_base}_filter.csv"
        csv_path = os.path.join(output_dir, csv_filename)
        df_final.to_csv(csv_path, index=False)
        print(f"Saved CSV file: {csv_path}")

        # Process video and extract screenshots
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Unable to open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        saved_count = 0
        processed_frames = []

        def get_frame_number(row):
            if "frame_number" in row and pd.notna(row["frame_number"]):
                return int(row["frame_number"])
            if "timestamp_seconds" in row and pd.notna(row["timestamp_seconds"]):
                return int(round(float(row["timestamp_seconds"]) * fps))
            return None

        # Convert rows to target frame numbers and reuse frames when possible
        df_final["target_frame"] = df_final.apply(get_frame_number, axis=1)
        last_frame_num = -1
        last_frame = None

        for idx, row in df_final.iterrows():
            target_frame = row["target_frame"]
            if target_frame is None:
                print(f"Skipping row {idx}: no timestamp or frame number available")
                continue

            if target_frame < 0:
                print(f"Skipping row {idx}: invalid frame number {target_frame}")
                continue

            if target_frame >= frame_count and frame_count > 0:
                target_frame = frame_count - 1

            if target_frame != last_frame_num:
                if last_frame_num >= 0 and target_frame == last_frame_num + 1:
                    success, frame = cap.read()
                elif last_frame_num >= 0 and target_frame > last_frame_num:
                    # Fast-forward sequentially, which is usually quicker than repeated random seek
                    skip = target_frame - last_frame_num - 1
                    for _ in range(skip):
                        if not cap.grab():
                            break
                    success, frame = cap.read()
                else:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                    success, frame = cap.read()

                if not success or frame is None:
                    print(f"Failed to read target frame {target_frame} for row {idx}")
                    last_frame_num = -1
                    last_frame = None
                    continue

                last_frame_num = target_frame
                last_frame = frame
            else:
                # Reuse the cached frame for duplicate targets
                if last_frame is None:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                    success, frame = cap.read()
                    if not success or frame is None:
                        print(f"Failed to read reused frame {target_frame} for row {idx}")
                        last_frame_num = -1
                        last_frame = None
                        continue
                    last_frame = frame
                frame = last_frame

            # Draw bounding box on a copy of the frame so duplicates on same frame don't accumulate
            frame_copy = frame.copy()
            x1, y1 = int(row["bbox_x1"]), int(row["bbox_y1"])
            x2, y2 = int(row["bbox_x2"]), int(row["bbox_y2"])
            cv2.rectangle(frame_copy, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label = f"uuid={row['uuid']} frame={target_frame} class={row['class_name']}"
            cv2.putText(frame_copy, label, (x1, max(20, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

            output_name = f"{row['uuid']}.webp"
            output_path = os.path.join(output_dir, output_name)
            cv2.imwrite(output_path, frame_copy)
            saved_count += 1

            processed_frames.append({
                "frame_index": idx,
                "uuid": int(row['uuid']),
                "timestamp": float(row['timestamp_seconds']) if "timestamp_seconds" in row and pd.notna(row["timestamp_seconds"]) else None,
                "class_name": row['class_name'],
                "confidence": float(row['confidence']),
                "bbox": [int(row['bbox_x1']), int(row['bbox_y1']), int(row['bbox_x2']), int(row['bbox_y2'])],
                "screenshot_path": output_path
            })

        cap.release()

        return {
            "success": True,
            "message": f"Video and CSV uploaded and processed successfully. {saved_count} screenshots extracted.",
            "video_filename": video.filename,
            "csv_filename": csv_file.filename,
            "title": title,
            "video_path": video_path,
            "csv_path": csv_path,
            "screenshots_dir": screenshots_dir,
            "csv_file": csv_filename,
            "csv_path": csv_path,
            "total_screenshots": saved_count,
            "processed_frames": processed_frames
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Upload/processing failed: {str(e)}"
        }

@app.get("/")
async def root():
    return {"message": "Video Processing Backend API"}

@app.get("/download_csv")
async def download_csv(video_filename: str):
    video_base = os.path.splitext(video_filename)[0]
    output_dir = os.path.join("downloaded", video_base)

    if not os.path.isdir(output_dir):
        raise HTTPException(status_code=404, detail="Screenshot folder not found")

    filtered_csv_path = None
    for fname in os.listdir(output_dir):
        if fname.endswith("_filter.csv"):
            filtered_csv_path = os.path.join(output_dir, fname)
            break

    final_csv_path = os.path.join(output_dir, f"{video_base}_final.csv")

    if filtered_csv_path and os.path.exists(filtered_csv_path):
        try:
            df = pd.read_csv(filtered_csv_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read filtered CSV: {e}")

        screenshot_uuids = set()
        for fname in os.listdir(output_dir):
            lower = fname.lower()
            if lower.endswith((".webp", ".png", ".jpg", ".jpeg")):
                base_name = os.path.splitext(fname)[0]
                if base_name.isdigit():
                    screenshot_uuids.add(int(base_name))

        if "uuid" in df.columns:
            df = df[df["uuid"].isin(screenshot_uuids)].copy()
        df = df.sort_values("uuid").reset_index(drop=True)
        df["screenshot_filename"] = df["uuid"].astype(str) + ".webp"
        df["screenshot_path"] = df["screenshot_filename"].apply(lambda p: os.path.join(output_dir, p))
        df.to_csv(final_csv_path, index=False)
    else:
        rows = []
        for fname in os.listdir(output_dir):
            lower = fname.lower()
            if lower.endswith((".webp", ".png", ".jpg", ".jpeg")):
                base_name = os.path.splitext(fname)[0]
                if base_name.isdigit():
                    rows.append({
                        "uuid": int(base_name),
                        "screenshot_filename": fname,
                        "screenshot_path": os.path.join(output_dir, fname),
                    })
        if not rows:
            raise HTTPException(status_code=404, detail="No screenshot files found for this video")

        df = pd.DataFrame(sorted(rows, key=lambda row: row["uuid"]))
        df.to_csv(final_csv_path, index=False)

    return FileResponse(final_csv_path, filename=f"{video_base}_final.csv", media_type="text/csv")

def build_final_csv_path(video_filename: str) -> str:
    video_filename = os.path.basename(video_filename)
    video_base = os.path.splitext(video_filename)[0]
    output_dir = os.path.join("downloaded", video_base)

    if not os.path.isdir(output_dir):
        raise FileNotFoundError(f"Screenshot folder not found for video: {video_filename}")

    filtered_csv_path = None
    for fname in os.listdir(output_dir):
        if fname.endswith("_filter.csv"):
            filtered_csv_path = os.path.join(output_dir, fname)
            break

    final_csv_path = os.path.join(output_dir, f"{video_base}_final.csv")

    if filtered_csv_path and os.path.exists(filtered_csv_path):
        df = pd.read_csv(filtered_csv_path)
        screenshot_uuids = set()
        for fname in os.listdir(output_dir):
            lower = fname.lower()
            if lower.endswith((".webp", ".png", ".jpg", ".jpeg")):
                base_name = os.path.splitext(fname)[0]
                if base_name.isdigit():
                    screenshot_uuids.add(int(base_name))

        if "uuid" in df.columns:
            df = df[df["uuid"].isin(screenshot_uuids)].copy()
        df = df.sort_values("uuid").reset_index(drop=True)
        df["screenshot_filename"] = df["uuid"].astype(str) + ".webp"
        df["screenshot_path"] = df["screenshot_filename"].apply(lambda p: os.path.join(output_dir, p))
        df.to_csv(final_csv_path, index=False)
    else:
        rows = []
        for fname in os.listdir(output_dir):
            lower = fname.lower()
            if lower.endswith((".webp", ".png", ".jpg", ".jpeg")):
                base_name = os.path.splitext(fname)[0]
                if base_name.isdigit():
                    rows.append({
                        "uuid": int(base_name),
                        "screenshot_filename": fname,
                        "screenshot_path": os.path.join(output_dir, fname),
                    })
        if not rows:
            raise FileNotFoundError(f"No screenshot files found for video: {video_filename}")

        df = pd.DataFrame(sorted(rows, key=lambda row: row["uuid"]))
        df.to_csv(final_csv_path, index=False)

    return final_csv_path


@app.post("/upload-zip")
async def upload_zip(zip_file: UploadFile = File(...)):
    """
    Handle ZIP file upload containing .webp images and _filter.csv
    Returns a session ID for tracking the uploaded file
    """
    try:
        if not zip_file.filename.endswith(".zip"):
            raise HTTPException(status_code=400, detail="File must be a ZIP file")
        
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        session_dir = os.path.join(ZIP_PROCESS_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        # Save ZIP file
        zip_path = os.path.join(session_dir, zip_file.filename)
        with open(zip_path, "wb") as buffer:
            content = await zip_file.read()
            buffer.write(content)
        
        # Extract ZIP file
        extract_dir = os.path.join(session_dir, "extracted")
        os.makedirs(extract_dir, exist_ok=True)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        
        # Check for _filter.csv
        filter_csv_path = None
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.endswith("_filter.csv"):
                    filter_csv_path = os.path.join(root, file)
                    break
            if filter_csv_path:
                break
        
        if not filter_csv_path:
            shutil.rmtree(session_dir)
            raise HTTPException(status_code=400, detail="_filter.csv not found in ZIP file")
        
        # Check for .webp images
        webp_files = []
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.endswith(".webp"):
                    webp_files.append(os.path.join(root, file))

        if not webp_files:
            shutil.rmtree(session_dir)
            raise HTTPException(status_code=400, detail="No .webp images found in ZIP file")

        # Create _final.csv from extracted images and _filter.csv
        try:
            df = pd.read_csv(filter_csv_path)
            webp_images = {os.path.splitext(os.path.basename(path))[0]: path for path in webp_files}

            if "uuid" in df.columns:
                df["uuid_str"] = df["uuid"].astype(str)
                df = df[df["uuid_str"].isin(webp_images.keys())].copy()
                df = df.drop(columns=["uuid_str"])
                df = df.sort_values("uuid").reset_index(drop=True)
            else:
                df = df.reset_index(drop=True)

            # Create filename based on ZIP filename
            zip_base_name = os.path.splitext(zip_file.filename)[0]
            final_csv_filename = f"{zip_base_name}_final.csv"
            final_csv_path = os.path.join(session_dir, final_csv_filename)
            df.to_csv(final_csv_path, index=False)
        except Exception as e:
            shutil.rmtree(session_dir)
            raise HTTPException(status_code=500, detail=f"Failed to create _final.csv: {str(e)}")

        return {
            "success": True,
            "session_id": session_id,
            "message": f"ZIP file extracted and _final.csv created successfully. Found {len(webp_files)} images and _filter.csv",
            "image_count": len(webp_files)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing ZIP file: {str(e)}")


@app.get("/download-final-csv")
async def download_final_csv(session_id: str):
    """
    Generate and download _final.csv based on uploaded ZIP contents
    """
    try:
        session_dir = os.path.join(ZIP_PROCESS_DIR, session_id)
        
        if not os.path.exists(session_dir):
            raise HTTPException(status_code=404, detail="Session not found")
        
        extract_dir = os.path.join(session_dir, "extracted")
        
        # Find _filter.csv
        filter_csv_path = None
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.endswith("_filter.csv"):
                    filter_csv_path = os.path.join(root, file)
                    break
            if filter_csv_path:
                break
        
        if not filter_csv_path:
            raise HTTPException(status_code=404, detail="_filter.csv not found")
        
        # Read _filter.csv
        df = pd.read_csv(filter_csv_path)
        
        # Find all .webp images and create mapping
        webp_images = {}
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.endswith(".webp"):
                    # Extract filename without extension
                    base_name = os.path.splitext(file)[0]
                    file_path = os.path.join(root, file)
                    webp_images[base_name] = file_path
        
        # Filter CSV to include only rows that have corresponding images
        if "uuid" in df.columns:
            # Convert uuid to string for matching
            df['uuid_str'] = df['uuid'].astype(str)
            df = df[df['uuid_str'].isin(webp_images.keys())].copy()
            df = df.drop('uuid_str', axis=1)
        
        # Sort by uuid if present
        if "uuid" in df.columns:
            df = df.sort_values("uuid").reset_index(drop=True)
        
        # Find the ZIP filename to create the final CSV filename
        zip_files = [f for f in os.listdir(session_dir) if f.lower().endswith('.zip')]
        if zip_files:
            zip_base_name = os.path.splitext(zip_files[0])[0]
            final_csv_filename = f"{zip_base_name}_final.csv"
        else:
            final_csv_filename = "_final.csv"
        
        # Save _final.csv
        final_csv_path = os.path.join(session_dir, final_csv_filename)
        df.to_csv(final_csv_path, index=False)
        
        # Return file
        return FileResponse(
            final_csv_path,
            filename=final_csv_filename,
            media_type="text/csv"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating final CSV: {str(e)}")


@app.get("/get-final-csv-filename")
async def get_final_csv_filename(session_id: str):
    """
    Get the filename of the final CSV file for this session
    """
    try:
        session_dir = os.path.join(ZIP_PROCESS_DIR, session_id)
        
        if not os.path.exists(session_dir):
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Find the ZIP file to determine the filename
        zip_files = [f for f in os.listdir(session_dir) if f.lower().endswith('.zip')]
        if zip_files:
            zip_base_name = os.path.splitext(zip_files[0])[0]
            final_csv_filename = f"{zip_base_name}_final.csv"
        else:
            final_csv_filename = "_final.csv"
        
        return {
            "filename": final_csv_filename
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting filename: {str(e)}")


@app.get("/download-uploaded-zip")
async def download_uploaded_zip(session_id: str):
    session_dir = os.path.join(ZIP_PROCESS_DIR, session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")

    zip_files = [f for f in os.listdir(session_dir) if f.lower().endswith('.zip')]
    if not zip_files:
        raise HTTPException(status_code=404, detail="Uploaded ZIP file not found")

    zip_path = os.path.join(session_dir, zip_files[0])
    return FileResponse(
        zip_path,
        filename=os.path.basename(zip_path),
        media_type="application/zip",
    )


@app.post("/cleanup-session")
async def cleanup_session(session_id: str):
    """
    Clean up uploaded files after download
    """
    try:
        session_dir = os.path.join(ZIP_PROCESS_DIR, session_id)
        
        if os.path.exists(session_dir):
            shutil.rmtree(session_dir)
        
        return {
            "success": True,
            "message": "Session cleaned up successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning up session: {str(e)}")

@app.get("/download_filtered_csv")
async def download_filtered_csv(video_filename: str):
    try:
        final_csv_path = build_final_csv_path(video_filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    video_base = os.path.splitext(os.path.basename(video_filename))[0]
    return FileResponse(final_csv_path, filename=f"{video_base}_final.csv", media_type="text/csv")

def build_video_zip_path(video_filename: str) -> str:
    video_filename = os.path.basename(video_filename)
    video_base = os.path.splitext(video_filename)[0]
    output_dir = os.path.join("downloaded", video_base)

    if not os.path.isdir(output_dir):
        raise FileNotFoundError(f"Screenshot folder not found for video: {video_filename}")

    image_extensions = (".webp", ".png", ".jpg", ".jpeg")
    image_files = [f for f in os.listdir(output_dir) if f.lower().endswith(image_extensions)]

    filtered_csv_files = [f for f in os.listdir(output_dir) if f.lower().endswith("_filter.csv")]
    filtered_csv_path = None
    filtered_csv_file = None
    if filtered_csv_files:
        filtered_csv_file = filtered_csv_files[0]
        filtered_csv_path = os.path.join(output_dir, filtered_csv_file)

    if not image_files and not filtered_csv_path:
        raise FileNotFoundError(f"No screenshot images or filtered CSV found for video: {video_filename}")

    zip_path = os.path.join(output_dir, f"{video_base}_zip.zip")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
        # Add filtered CSV file first if it exists
        if filtered_csv_path and os.path.exists(filtered_csv_path):
            zipf.write(filtered_csv_path, arcname=filtered_csv_file)

        # Add screenshot images
        for fname in sorted(image_files):
            zipf.write(os.path.join(output_dir, fname), arcname=fname)

    return zip_path

@app.get("/download_zip")
async def download_zip(video_filename: str):
    try:
        zip_path = build_video_zip_path(video_filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return FileResponse(
        zip_path,
        filename=f"{os.path.splitext(os.path.basename(video_filename))[0]}_zip.zip",
        media_type="application/zip",
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)












