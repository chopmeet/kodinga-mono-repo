from django.core.management.base import BaseCommand
from apps.communities.models.category import CommunityCategory

# 8 Official developer categories with sub-specialties reference
CATEGORIES_DATA = [
    {
        "name": "Web Development",
        "slug": "web-development",
        "description": "Développement d'applications web et de sites internet.",
        "icon_url": "https://cdn.kodinga.com/icons/categories/web-dev.svg",
        "order": 1,
        "sub_specialties": [
            "Frontend Development",
            "Backend Development",
            "Fullstack Development",
        ],
    },
    {
        "name": "Mobile Development",
        "slug": "mobile-development",
        "description": (
            "Conception et développement d'applications mobiles pour smartphones et"
            " tablettes."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/mobile-dev.svg",
        "order": 2,
        "sub_specialties": [
            "Android Development",
            "iOS Development",
            "Cross-platform Development",
        ],
    },
    {
        "name": "AI & Machine Learning",
        "slug": "ai-machine-learning",
        "description": (
            "Conception de systèmes intelligents, de modèles d'apprentissage"
            " automatique et d'applications basées sur l'IA."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/ai-ml.svg",
        "order": 3,
        "sub_specialties": [
            "Machine Learning",
            "Deep Learning",
            "Generative AI",
            "AI Agents",
            "Natural Language Processing",
            "Computer Vision",
        ],
    },
    {
        "name": "Data Engineering",
        "slug": "data-engineering",
        "description": (
            "Collecte, traitement, transformation, stockage et exploitation"
            " des données."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/data-engineering.svg",
        "order": 4,
        "sub_specialties": [
            "Data Engineering",
            "Data Analysis",
            "Data Science",
            "Business Intelligence",
            "Big Data",
        ],
    },
    {
        "name": "Cloud & DevOps",
        "slug": "cloud-devops",
        "description": (
            "Déploiement, exploitation, automatisation et maintenance des"
            " infrastructures et applications."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/cloud-devops.svg",
        "order": 5,
        "sub_specialties": [
            "DevOps",
            "Cloud Engineering",
            "Site Reliability Engineering (SRE)",
            "Platform Engineering",
            "Infrastructure as Code",
        ],
    },
    {
        "name": "Cybersecurity",
        "slug": "cybersecurity",
        "description": (
            "Protection des applications, des systèmes, des réseaux et des"
            " infrastructures informatiques."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/cybersecurity.svg",
        "order": 6,
        "sub_specialties": [
            "Application Security",
            "Penetration Testing",
            "Network Security",
            "Cloud Security",
            "Security Engineering",
        ],
    },
    {
        "name": "Systems & Embedded",
        "slug": "systems-embedded",
        "description": (
            "Développement de logiciels système, de logiciels embarqués et de solutions"
            " interagissant directement avec le matériel."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/systems-embedded.svg",
        "order": 7,
        "sub_specialties": [
            "Systems Programming",
            "Embedded Systems",
            "IoT Development",
            "Firmware Development",
            "Low-level Programming",
        ],
    },
    {
        "name": "Game Development",
        "slug": "game-development",
        "description": (
            "Conception et développement de jeux vidéo, de moteurs de jeu et"
            " d'expériences interactives."
        ),
        "icon_url": "https://cdn.kodinga.com/icons/categories/game-dev.svg",
        "order": 8,
        "sub_specialties": [
            "Game Programming",
            "Game Engine Development",
            "3D Development",
            "Game Physics",
            "AR/VR Development",
        ],
    },
]


class Command(BaseCommand):
    help = "Seed the 8 official developer categories for communities and profiles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Reset order and descriptions to initial defaults even if modified.",
        )

    def handle(self, *args, **options):
        reset = options.get("reset", False)
        created_count = 0
        updated_count = 0

        self.stdout.write("Starting categories seed...")

        for cat_info in CATEGORIES_DATA:
            slug = cat_info["slug"]
            name = cat_info["name"]
            description = cat_info["description"]
            icon_url = cat_info["icon_url"]
            order = cat_info["order"]

            category, created = CommunityCategory.objects.get_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "description": description,
                    "icon_url": icon_url,
                    "order": order,
                    "is_active": True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  [+] Created category: '{name}' ({slug})")
                )
            else:
                if reset or not category.description:
                    category.name = name
                    category.description = description
                    category.icon_url = icon_url
                    category.order = order
                    category.is_active = True
                    category.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"  [*] Updated existing category: '{name}' ({slug})"
                        )
                    )
                else:
                    self.stdout.write(
                        f"  [-] Skipped existing category: '{name}' ({slug})"
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nCategories seed completed! Total: {len(CATEGORIES_DATA)} | Created: {created_count} | Updated: {updated_count}"
            )
        )
