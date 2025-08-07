import requests
import json
import os
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

os.system("clear")

load_dotenv()
DBAPI_URL = os.getenv("DBAPI_URL")



#Devpost scraper
def searchFor(hackathon):
    api_url = f"https://devpost.com/api/hackathons?search={hackathon}"
    r = requests.get(api_url)
    r.raise_for_status()
    data = r.json()
    
    hackathons = data['hackathons']
    if len(hackathons) == 0:
        raise NameError("Hackathon not found")
    
    H = hackathons[0]
    hackathon_title = H['title']
    suburl = H['submission_gallery_url']
    
    r = requests.get(suburl)
    r.raise_for_status()
    parser = BeautifulSoup(r.content, "html.parser")
    links = [l['href'] for l in parser.find_all("a", class_ = "link-to-software")]
    
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

        
        #External Links
        subL = {}
        links = pparser.find("nav", class_ = "app-links")
        ul = links.find_all("ul")
        for lst in ul:
            ul_name = lst['data-role']
            ulL = {}
            els = [el.find('a') for el in lst.find_all("li")]
            for el in els:
                href = el['href']
                name = el.find("span").decode_contents()
                ulL[name] = href
            subL[ul_name] = ulL


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
        "entries" : L
    }



#Create leaderboard by devpost requirements
def createDevpostLd(hackathon, host, description):
    hackathon_data = searchFor(hackathon)
    body = {
        "name" : hackathon_data['title'],
        "host" : host,
        "description" : description,
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



#Populates leaderboard from devpost
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
        
        for key in hack['links'].keys():
            linkset = hack['links'][key]
            for i, name in enumerate(list(linkset.keys())):
                body['data'][f"Links {i} caption"] = name
                body['data'][f"Links {i}"] = linkset[name]


        r = requests.post(f"{DBAPI_URL}/leaderboard/createSubmission", json=body)
        r.raise_for_status()
        



hackathon = "cgcian"
createDevpostLd(hackathon, "ap", "Some random ass hackathon offa Devpost")
populateDevpostLd(hackathon)