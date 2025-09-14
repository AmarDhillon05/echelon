import requests
import json
import os
import requests
import zlib
import base64
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from ai_helpers import generate_html

os.system("clear")

load_dotenv()
DBAPI_URL = os.getenv("DBAPI_URL")
print(f"Using dbapi = {DBAPI_URL}")



#For sending
def compress_to_base64(url):
    # Add scheme if missing
    if url.startswith("//"):
        url = "https:" + url


    # Fetch the image from the URL
    response = requests.get(url)
    response.raise_for_status()  # raise an error if the request failed
    data = response.content  # bytes of the image

    # Compress using zlib (equivalent to pako.deflate)
    compressed = zlib.compress(data, level=9)

    # Standard base64
    b64 = base64.b64encode(compressed).decode('ascii')

    # Convert to URL-safe base64 (base64url)
    b64url = b64.replace('+', '-').replace('/', '_').rstrip('=')

    return b64url


#Root method
def find(hackathon):
    api_url = f"https://devpost.com/api/hackathons?search={hackathon}"
    r = requests.get(api_url)
    r.raise_for_status()
    data = r.json()

    return data['hackathons']

#Devpost name suggestions
def searchForName(hackathon):
    return [i['title'] for i in find(hackathon)]


#Devpost scraper
def searchFor(hackathon):
    hackathons = find(hackathon)
    
    H = hackathons[0]
    hackathon_title = H['title']
    suburl = H['submission_gallery_url']
    
    r = requests.get(suburl)
    r.raise_for_status()
    parser = BeautifulSoup(r.content, "html.parser")
    links = [l['href'] for l in parser.find_all("a", class_ = "link-to-software")]
    

    #D 
    hack_url = H['url']
    r = requests.get(hack_url)
    r.raise_for_status()
    parser = BeautifulSoup(r.content, 'html.parser')
    desc = parser.find('article', id = 'challenge-description')
    desc = ''.join(desc.stripped_strings)

    #C
    coverPhoto = H['thumbnail_url']
    coverPhoto = compress_to_base64(coverPhoto)
    
    
    L = []
    for l in links: #links to each submission
        r = requests.get(l)
        r.raise_for_status()
        pparser = BeautifulSoup(r.content, "html.parser")


        #Attatchments
        A = {}
        images = pparser.find_all("img", class_ = "software_photo_image")
        vids = pparser.find_all("iframe", class_ = "video-embed")
        for img in images:
            A[img.get('alt')] = img['src']
        for vid in vids:
            A[vid.get('title')] = vid['src']
        


        #Title
        title = pparser.find(id = "app-title").decode_contents()


        #Info
        all_divs = pparser.find_all("div")
        idx_of_builtwith = [idx for idx, i in enumerate(all_divs) if i.has_attr("id") and i['id'] == "built-with"][0]
        info_div = all_divs[idx_of_builtwith - 1]
        info = info_div.decode_contents()
        info = generate_html(info)

        
        #External Links
        subL = {'Devpost' : l}
        links = pparser.find("nav", class_ = "app-links")
        if links is not None:
            ul = links.find_all("ul")
            for lst in ul:
                els = [el.find('a') for el in lst.find_all("li")]
                for el in els:
                    href = el['href']
                    name = el.find("span").decode_contents()
                    subL[name] = href
                
    


        #Contributors
        contribs = {}
        contrib_els = pparser.find_all("a", class_ = "user-profile-link")
        for el in contrib_els:
            if not el.find('img'):
                contribs[el.decode_contents()] = el['href']


        L.append({
            "title" : title,
            "attatchments" : A,
            "info" : info,
            "links" : subL,
            "contributors" : contribs
        })

    return {
        "title" : hackathon_title,
        "coverPhoto" : coverPhoto,
        "desc" : generate_html(desc),
        "entries" : L
    }



#Create leaderboard by devpost requirements
def createDevpostLd(hackathon, host):
    hackathon_data = searchFor(hackathon)
    body = {
        "name" : hackathon_data['title'],
        "host" : host,
        "description" : hackathon_data['desc'],
        "coverPhoto" : hackathon_data['coverPhoto'],
        "required" : [
            {
                "name" : "Attatchments",
                "type" : "link",
                "list" : "yes",
                "amount" : "any"
            },
            {
                "name" : "Info",
                "type" : "text",
                "list" : "no",
                "important" : "yes"
            },
            {
                "name" : "Links",
                "type" : "link",
                "list" : "yes",
                "amount" : "any"
            }
        ]
    }



    r = requests.post(f"{DBAPI_URL}/leaderboard/createLeaderboard", json=body)

    r.raise_for_status()
    return r.json()




#Populates leaderboard from devpost
#Generator function for response for creating + populating
def populateDevpostLd(hackathon):

    hackathon_data = searchFor(hackathon)
    ld = hackathon_data['title']
    for hack in hackathon_data['entries']: 

        body = {
            "leaderboard" : ld,
            "contributors" : list(hack['contributors'].keys()),
            "name" : hack['title'],
            "data" : {
                "name" : "title",
                "Info" : hack['info'],
            }
        }


        for i, name in enumerate(list(hack['attatchments'].keys())):
            body['data'][f"Attatchments {i} caption"] = name
            body['data'][f"Attatchments {i}"] = hack['attatchments'][name]
        

        
        for i, (key, link) in enumerate(hack['links'].items()):
            body['data'][f"Links {i} caption"] = key
            body['data'][f"Links {i}"] = link
     


        r = requests.post(f"{DBAPI_URL}/leaderboard/createSubmission", json=body)
        j = r.json()
        if j.get('error') is not None:
            print(j.get('error'))

        



