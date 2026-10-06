import json
import re
import xml.etree.ElementTree as ET

from django.test import TestCase, override_settings
from django.utils.html import escape

from .models import Job, JobYear, Paper, SiteSetting
from .views import _seo_past_papers_catalog, _seo_past_papers_record


@override_settings(SECURE_SSL_REDIRECT=False)
class PastPapersSEOTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        SiteSetting.objects.create(singleton=1)
        cls.ppsc=Paper.objects.create(id=1,name='Punjab Public Service Commission [PPSC]')
        cls.spsc=Paper.objects.create(id=2,name='Sindh Public Service Commission [SPSC]')
        cls.assistant=Job.objects.create(id=10,name='Assistant',paper=cls.ppsc)
        cls.sindh_assistant=Job.objects.create(id=20,name='Assistant',paper=cls.spsc)
        JobYear.objects.create(id=100,name='2024',job=cls.assistant)
        JobYear.objects.create(id=200,name='2025',job=cls.sindh_assistant)

    def page(self,path,status=200):
        response=self.client.get(path)
        self.assertEqual(response.status_code,status)
        html=response.content.decode()
        match=re.search(r'<script id="seo-discovery-page" type="application/json">(.*?)</script>',html,re.S)
        self.assertIsNotNone(match)
        data=json.loads(match.group(1))
        self.assertIn(str(escape(data['title'])),html)
        return data,html

    def urls(self,path):
        return [node.text for node in ET.fromstring(self.client.get(path).content).iter() if node.tag.endswith('}loc')]

    def test_paper_acronym_is_the_preferred_search_intent_url(self):
        page,html=self.page('/ppsc-past-papers')
        self.assertEqual(page['canonical'],'https://www.mcqcampus.com/ppsc-past-papers')
        self.assertEqual(page['heading'],'PPSC Past Papers')
        self.assertEqual(page['title'],'PPSC Past Papers, Jobs & MCQs')
        self.assertIn('https://www.mcqcampus.com/ppsc-past-papers',self.urls('/sitemap-papers.xml'))
        alias,_=self.page('/punjab-public-service-commission-ppsc-past-papers')
        self.assertEqual(alias['canonical'],'https://www.mcqcampus.com/ppsc-past-papers')

    def test_papers_hub_mentions_priority_exam_acronyms_and_links_canonical_pages(self):
        response=self.client.get('/papers')
        self.assertEqual(response.status_code,200)
        html=response.content.decode()
        self.assertIn('PPSC, FPSC, SPSC, BPSC, NTS, ATS',html)
        self.assertIn('href="/ppsc-past-papers"',html)

    def test_paper_and_qualified_job_keep_the_correct_hierarchy(self):
        page,_=self.page('/ppsc-past-papers')
        links=[url for _,rows in page['groups'] for _,url in rows]
        self.assertIn('/ppsc-assistant-past-papers',links)
        self.assertNotIn('/spsc-assistant-past-papers',links)
        page,_=self.page('/ppsc-assistant-past-papers')
        links=[url for _,rows in page['groups'] for _,url in rows]
        self.assertIn('/paper/punjab-public-service-commission-ppsc/job/assistant/year/2024',links)
        self.assertFalse(any('/sindh-' in url for url in links))
        self.assertEqual(page['title'],'PPSC Assistant Past Papers & Solved MCQs')

    def test_generic_job_aggregates_matching_jobs_across_organizations(self):
        page,_=self.page('/assistant-past-papers')
        links=[url for _,rows in page['groups'] for _,url in rows]
        self.assertIn('/ppsc-assistant-past-papers',links)
        self.assertIn('/spsc-assistant-past-papers',links)
        self.assertEqual(page['heading'],'Assistant Past Papers')

    def test_full_name_alias_has_one_preferred_canonical(self):
        page,html=self.page('/punjab-public-service-commission-ppsc-past-papers')
        self.assertEqual(page['canonical'],'https://www.mcqcampus.com/ppsc-past-papers')
        self.assertIn('rel="canonical" href="'+page['canonical']+'"',html)
        self.assertIn(page['canonical'],self.urls('/sitemap-papers.xml'))

    def test_sitemaps_focus_on_canonical_search_intent_landings(self):
        paper_urls=self.urls('/sitemap-papers.xml')
        job_urls=self.urls('/sitemap-jobs.xml')
        urls=paper_urls+job_urls
        self.assertEqual(len(urls),len(set(urls)))
        self.assertIn('https://www.mcqcampus.com/ppsc-past-papers',paper_urls)
        self.assertIn('https://www.mcqcampus.com/ppsc-assistant-past-papers',job_urls)
        self.assertNotIn('https://www.mcqcampus.com/paper/punjab-public-service-commission-ppsc',paper_urls)
        self.assertFalse(any('/paper/' in url and '/job/' in url for url in job_urls))
        self.assertFalse(any(url.endswith('/assistant-past-papers') for url in job_urls))
        for url in urls:
            path=url.removeprefix('https://www.mcqcampus.com')
            data,_=self.page(path)
            self.assertEqual(data['canonical'],url)
            self.assertEqual(data['robots'],'index,follow')

    def test_original_hierarchy_alias_uses_search_intent_canonical(self):
        path='/paper/punjab-public-service-commission-ppsc/job/assistant'
        response=self.client.get(path)
        self.assertEqual(response.status_code,200)
        html=response.content.decode()
        self.assertIn('href="https://www.mcqcampus.com/ppsc-assistant-past-papers"',html)
        self.assertNotIn('id="seo-discovery-page"',html)

    def test_qualified_and_generic_job_slug_collision_does_not_mix_records(self):
        job=Job.objects.create(id=30,name='PPSC Assistant',paper=self.spsc)
        JobYear.objects.create(id=300,name='2026',job=job)
        catalog=_seo_past_papers_catalog()
        self.assertEqual(_seo_past_papers_record('/ppsc-assistant-past-papers',catalog)['job'].id,10)
        group=_seo_past_papers_record(catalog['group_paths']['ppsc-assistant'],catalog)
        self.assertEqual([j.id for j in group['jobs']],[30])
        urls=self.urls('/sitemap-jobs.xml')
        self.assertEqual(len(urls),len(set(urls)))

    def test_duplicate_acronyms_and_slugs_still_resolve_to_their_own_ids(self):
        other=Paper.objects.create(id=3,name='Other Public Service Commission [PPSC]')
        Job.objects.create(id=30,name='Assistant',paper=other)
        Job.objects.create(id=40,name='Assistant!',paper=self.ppsc)
        with self.assertNumQueries(3):
            catalog=_seo_past_papers_catalog()
        for job in catalog['jobs']:
            record=_seo_past_papers_record(catalog['job_paths'][job.id],catalog)
            self.assertEqual(record['job'].id,job.id)
            self.assertEqual(record['paper'].id,job.paper_id)

    def test_unknown_disabled_and_empty_job_pages_are_not_indexable(self):
        page,_=self.page('/nonexistent-past-papers',404)
        self.assertEqual(page['robots'],'noindex,nofollow')
        self.ppsc.active=False
        self.ppsc.save()
        self.page('/ppsc-assistant-past-papers',404)
        self.assertNotIn('ppsc', ''.join(self.urls('/sitemap-jobs.xml')))
        Job.objects.create(id=40,name='Empty Role',paper=self.spsc)
        page,_=self.page('/spsc-empty-role-past-papers')
        self.assertEqual(page['robots'],'noindex,follow')
        self.assertNotIn('empty-role', ''.join(self.urls('/sitemap-jobs.xml')))

    def test_new_data_appears_automatically_and_long_titles_keep_past_papers(self):
        name='Administrative Officer for Education and Training Services'
        job=Job.objects.create(id=30,name=name,paper=self.ppsc)
        JobYear.objects.create(id=300,name='2026',job=job)
        catalog=_seo_past_papers_catalog()
        generic_path=catalog['group_paths']['administrative-officer-for-education-and-training-services']
        qualified_path=catalog['job_paths'][job.id]
        page,_=self.page(generic_path)
        self.assertEqual(page['title'],name+' Past Papers')
        self.assertEqual(page['robots'],'index,follow')
        self.assertIn('https://www.mcqcampus.com'+qualified_path,self.urls('/sitemap-jobs.xml'))
        self.assertNotIn('https://www.mcqcampus.com'+generic_path,self.urls('/sitemap-jobs.xml'))
        qualified,_=self.page(qualified_path)
        self.assertIn('PPSC '+name+' Past Papers',qualified['title'])

    def test_keyword_landings_have_crawlable_supporting_content_and_itemlist(self):
        page,html=self.page('/ppsc-assistant-past-papers')
        self.assertIn('PPSC Assistant past papers by year',html)
        schema=page['schema']['@graph']
        webpage=next(node for node in schema if node.get('@id','').endswith('#webpage'))
        self.assertIn('CollectionPage',webpage['@type'])
        item_list=next(node for node in schema if node.get('@type')=='ItemList')
        urls=[item['url'] for item in item_list['itemListElement']]
        self.assertIn('https://www.mcqcampus.com/paper/punjab-public-service-commission-ppsc/job/assistant/year/2024',urls)

    def test_jobs_exams_hub_links_to_search_intent_job_landings(self):
        response=self.client.get('/jobs-exams')
        self.assertEqual(response.status_code,200)
        html=response.content.decode()
        self.assertIn('href="/ppsc-assistant-past-papers"',html)
        self.assertIn('PPSC Assistant Past Papers',html)

    def test_names_are_escaped_in_discovery_json_and_html(self):
        job=Job.objects.create(id=30,name='Operator </script><img src=x onerror=alert(1)>',paper=self.ppsc)
        JobYear.objects.create(id=300,name='2026',job=job)
        path=_seo_past_papers_catalog()['job_paths'][job.id]
        page,html=self.page(path)
        self.assertIn(job.name,page['heading'])
        self.assertNotIn('<img src=x onerror=alert(1)>',html)
