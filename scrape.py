import requests
import json
from bs4 import BeautifulSoup


def searchfor(hackathon):
    api_url = f"https://devpost.com/api/hackathons?search={hackathon}"
    r = requests.get(api_url)
    r.raise_for_status()
    data = r.json()
    
    hackathons = data['hackathons']
    if len(hackathons) == 0:
        raise NameError("Hackathon not found")
    
    H = hackathons[0]
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



        L.append({
            "title" : title,
            "attatchments" : A,
            "info" : info,
            "links" : subL
        })

    return L




print(searchfor("cgcian"))