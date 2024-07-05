import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import openai

app = FastAPI()

# Allowing CORS for all domains (for development purposes)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure your OpenAI API key is set
openai.api_key = 'api_key'

@app.post('/upload')
async def upload_file(file: UploadFile = File(...), prompt: str = Form('')):
    try:
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded")
        
        file_content = await file.read()
        
        if not file_content:
            raise HTTPException(status_code=400, detail="Empty file")
        
        file_path = f'/tmp/{file.filename}'
        
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        print(f"File saved to {file_path}")
        
        try:
            # Using PyMuPDF (fitz) for PDF text extraction
            doc = fitz.open(file_path)
            text = ""
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text += page.get_text()
            
            doc.close()
            os.remove(file_path)
            print("Temporary file removed")
            
            # Use OpenAI to process the text
            response = openai.Completion.create(
                engine="gpt-3.5-turbo-instruct",
                prompt=prompt + '\n' + text,  # Applying prompt to the extracted text from PDF
                max_tokens=1000,
                n=1,
                stop=None,
                temperature=0.7
            )
            print("Received response from OpenAI")
            
            extracted_text = response.choices[0].text.strip()
            
            # Example filtering based on a keyword
            extracted_info = {
                "extracted_text": extracted_text
            }
            
            print(f'Extracted information from {file.filename}:')
            print(extracted_info)
            
            return extracted_info
        
        except Exception as e:
            print(f"Error extracting text: {e}")
            raise HTTPException(status_code=500, detail=f"Error extracting text from PDF: {e}")
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=3001)
