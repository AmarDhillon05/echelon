import os
from dotenv import load_dotenv
from mistralai import Mistral

load_dotenv()
api_key = os.environ["MISTRAL"]
client = Mistral(api_key=api_key)

model = "codestral-latest"

prompt =  lambda text_to_convert  : f'''
Convert the following text into HTML using only <h1>-<h6> headers and <p> paragraphs.
- Treat the first phrase of each section as the heading.
- Place the remaining text of that section in a <p> tag.
- Use <h1> for the first heading, <h2> for additional headings.
- Do not use any other tags, styles, or attributes.

Text:
{text_to_convert}

<div>
'''

suffix = "</div>"

def generate_html(text):
    try:

        response = client.fim.complete(
            model=model,
            prompt=prompt(text),
            suffix=suffix,
            temperature=0,
            # min_tokens=1, # Uncomment to enforce completions to at least 1 token
        )
        
        x = f"""
        <div>
        {response.choices[0].message.content}
        {suffix}
        """

        return x

    except Exception as e:

        return text