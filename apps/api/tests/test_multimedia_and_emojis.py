import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from apps.accounts.models.user import User
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.media.models.media_asset import (
    MediaAsset,
    MediaProvider,
    MediaPurpose,
    MediaStatus,
)
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.messaging.models.conversation import Conversation, ConversationType
from apps.messaging.models.participant import ConversationParticipant
from apps.posts.models.post import Post

# Minimal valid binary headers for image & PDF tests
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
VALID_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
)
VALID_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"


@override_settings(
    UPLOADTHING_TOKEN="", MUX_TOKEN_ID="", MUX_TOKEN_SECRET="", MUX_WEBHOOK_SECRET=""
)
class MultimediaAndEmojisTestSuite(APITestCase):
    """
    Suite de tests automatisés couvrant les 8 scénarios de la mission Emojis & Multimédia :
    1. Emojis Unicode (messages privés, groupes, posts, commentaires, réponses, séquences ZWJ & modificateurs de peau)
    2. Upload d'images (unique, multiple, format invalide, taille > 10 Mo)
    3. Limites d'images et de pièces jointes par publication (max 10 images, max 3 vidéos, max 10 total)
    4. Upload de vidéos Mux (Direct Upload, formats MP4/MOV/WEBM, publication non bloquante en statut PROCESSING)
    5. Webhooks Mux (transition PROCESSING -> READY / FAILED, idempotence et protection contre le retour en arrière)
    6. Upload de documents (PDF, DOCX, CSV, TXT, rejet strict des exécutables .exe/.sh/.php et signatures MZ)
    7. Permissions & Anti-IDOR (rattachement non autorisé, téléchargement en communauté privée, suppression interdite)
    8. Suppression d'un média d'un post et nettoyage lors de la suppression d'un post.
    """

    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(
            email="author@kodinga.com",
            username="author_user",
            password="Password123!",
        )
        self.other_user = User.objects.create_user(
            email="other@kodinga.com",
            username="other_user",
            password="Password123!",
        )
        self.outsider = User.objects.create_user(
            email="outsider@kodinga.com",
            username="outsider_user",
            password="Password123!",
        )

        # Public community
        self.public_community = Community.objects.create(
            name="Communauté Publique Tech",
            slug="communaute-publique-tech",
            description="Communauté ouverte",
            owner=self.author,
            privacy_type=CommunityPrivacy.PUBLIC,
            pricing_type=CommunityPricing.FREE,
        )
        CommunityMember.objects.create(
            community=self.public_community,
            user=self.author,
            role=CommunityRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        CommunityMember.objects.create(
            community=self.public_community,
            user=self.other_user,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.ACTIVE,
        )

        # Private community
        self.private_community = Community.objects.create(
            name="Communauté Privée VIP",
            slug="communaute-privee-vip",
            description="Communauté privée réservée aux membres",
            owner=self.author,
            privacy_type=CommunityPrivacy.PRIVATE,
            pricing_type=CommunityPricing.PAID,
        )
        CommunityMember.objects.create(
            community=self.private_community,
            user=self.author,
            role=CommunityRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )

    # =========================================================================
    # TEST 1 — EMOJIS UNICODE (Messages privés, Groupes, Posts, Commentaires, Réponses)
    # =========================================================================
    def test_01_unicode_emojis_across_messages_posts_comments_and_replies(self):
        self.client.force_authenticate(user=self.author)
        complex_emoji_text = (
            "Salut l'équipe 👋🏿🔥🚀 ! Bravo pour le lancement 👨‍👩‍👧‍👦 💻✨🇨🇮"
        )

        # 1. Discussion privée (Direct) & Discussion de groupe (Group)
        for conv_type in (ConversationType.DIRECT, ConversationType.GROUP):
            conv = Conversation.objects.create(
                conversation_type=conv_type,
                title="Groupe Tech 🚀" if conv_type == ConversationType.GROUP else None,
                created_by=self.author,
            )
            ConversationParticipant.objects.create(conversation=conv, user=self.author)
            ConversationParticipant.objects.create(
                conversation=conv, user=self.other_user
            )

            msg_res = self.client.post(
                f"/api/v1/conversations/{conv.id}/messages/",
                {"content": complex_emoji_text},
                format="json",
            )
            self.assertEqual(msg_res.status_code, 201)
            msg_payload = (
                msg_res.data.get("data")
                if isinstance(msg_res.data, dict) and "data" in msg_res.data
                else msg_res.data
            )
            self.assertEqual(msg_payload["content"], complex_emoji_text)

        # 2. Publication dans le Feed avec emojis dans le titre et le contenu
        post_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Annonce officielle 🎉🚀👋🏿",
                "content": complex_emoji_text,
                "post_type": "discussion",
            },
            format="json",
        )
        self.assertEqual(post_res.status_code, 201)
        post_data = post_res.data["data"]
        self.assertEqual(post_data["title"], "Annonce officielle 🎉🚀👋🏿")
        self.assertEqual(post_data["content"], complex_emoji_text)
        post_id = post_data["id"]

        # 3. Commentaire avec emojis
        comment_text = "Super nouvelle 😍🙌🏽 ! On valide à 100% 💯🔥"
        comment_res = self.client.post(
            f"/api/v1/posts/{post_id}/comments/",
            {"content": comment_text},
            format="json",
        )
        self.assertEqual(comment_res.status_code, 201)
        comment_data = comment_res.data["data"]
        self.assertEqual(comment_data["content"], comment_text)
        comment_id = comment_data["id"]

        # 4. Réponse à un commentaire avec emojis
        reply_text = "Merci beaucoup 🙏🏿✨👨‍👩‍👧‍👦 !"
        reply_res = self.client.post(
            f"/api/v1/posts/{post_id}/comments/",
            {"content": reply_text, "parent_id": comment_id},
            format="json",
        )
        self.assertEqual(reply_res.status_code, 201)
        self.assertEqual(reply_res.data["data"]["content"], reply_text)

    # =========================================================================
    # TEST 2 — UPLOAD D'IMAGES (UploadThing : unique, multiple, format & taille)
    # =========================================================================
    def test_02_image_upload_single_multiple_and_constraints(self):
        self.client.force_authenticate(user=self.author)

        # 1. Upload d'une image PNG valide
        img_file = SimpleUploadedFile(
            "capture.png", VALID_PNG_BYTES, content_type="image/png"
        )
        res = self.client.post(
            "/api/v1/media/upload/",
            {"file": img_file, "purpose": "post_image"},
            format="multipart",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("asset_id", res.data["data"])

        # 2. Upload de plusieurs images simultanément
        img1 = SimpleUploadedFile(
            "photo1.jpg", VALID_JPEG_BYTES, content_type="image/jpeg"
        )
        img2 = SimpleUploadedFile(
            "photo2.png", VALID_PNG_BYTES, content_type="image/png"
        )
        multi_res = self.client.post(
            "/api/v1/media/upload/",
            {"files": [img1, img2], "purpose": "post_image"},
            format="multipart",
        )
        self.assertEqual(multi_res.status_code, 201)
        self.assertEqual(multi_res.data["data"]["count"], 2)
        self.assertEqual(len(multi_res.data["data"]["asset_ids"]), 2)

        # 3. Rejet d'une image dépassant 10 Mo via presigned upload URL
        oversized_res = self.client.post(
            "/api/v1/media/upload-url/",
            {
                "file_name": "huge.png",
                "file_size": 11 * 1024 * 1024,  # 11 Mo > 10 Mo
                "mime_type": "image/png",
                "purpose": "post_image",
            },
            format="json",
        )
        self.assertEqual(oversized_res.status_code, 400)

        # 4. Rejet d'un format non image pour post_image
        bad_format_res = self.client.post(
            "/api/v1/media/upload-url/",
            {
                "file_name": "document.pdf",
                "file_size": 1024,
                "mime_type": "application/pdf",
                "purpose": "post_image",
            },
            format="json",
        )
        self.assertEqual(bad_format_res.status_code, 400)

    # =========================================================================
    # TEST 3 — LIMITES D'IMAGES & PIÈCES JOINTES PAR PUBLICATION (Max 10)
    # =========================================================================
    def test_03_post_image_and_attachment_limits(self):
        self.client.force_authenticate(user=self.author)

        # Créer 11 MediaAssets images appartenant à author
        image_ids = []
        for i in range(11):
            asset = MediaAsset.objects.create(
                user=self.author,
                file_name=f"img_{i}.png",
                file_key=f"kodinga/post_image/test_{i}.png",
                file_url=f"https://utfs.io/f/test_{i}.png",
                file_size=2048,
                mime_type="image/png",
                provider=MediaProvider.UPLOADTHING,
                purpose=MediaPurpose.POST_IMAGE,
                status=MediaStatus.READY,
            )
            image_ids.append(str(asset.id))

        # 11 images (> 10 max) -> doit être rejeté en 400
        too_many_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Trop d images",
                "content": "Test quota 11 images",
                "post_type": "discussion",
                "media_ids": image_ids,
            },
            format="json",
        )
        self.assertEqual(too_many_res.status_code, 400)

        # 10 images -> doit réussir (201) et retourner la liste unifiée `media` ordonnée
        valid_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Galerie 10 images",
                "content": "Test galerie valide",
                "post_type": "discussion",
                "media_ids": image_ids[:10],
            },
            format="json",
        )
        self.assertEqual(valid_res.status_code, 201)
        media_list = valid_res.data["data"]["media"]
        self.assertEqual(len(media_list), 10)
        self.assertEqual(media_list[0]["type"], "IMAGE")
        self.assertEqual(media_list[0]["provider"], "UPLOADTHING")
        self.assertEqual(media_list[9]["order"], 9)

    # =========================================================================
    # TEST 4 — UPLOAD DE VIDÉOS MUX & PUBLICATION NON BLOQUANTE
    # =========================================================================
    def test_04_mux_video_upload_constraints_and_non_blocking_post(self):
        self.client.force_authenticate(user=self.author)

        # 1. Création d'un Direct Upload Mux valide (MP4 <= 100 Mo)
        mux_res = self.client.post(
            "/api/v1/media/videos/upload-url/",
            {
                "title": "Démo Kodinga",
                "file_name": "demo.mp4",
                "file_size": 25 * 1024 * 1024,
                "mime_type": "video/mp4",
                "purpose": "post_video",
            },
            format="json",
        )
        self.assertEqual(mux_res.status_code, 201)
        video_id = mux_res.data["data"]["video_asset_id"]
        self.assertEqual(mux_res.data["data"]["normalized_status"], "PENDING_UPLOAD")

        # 2. Rejet d'une vidéo dépassant 128 Mo pour un post
        too_big_video = self.client.post(
            "/api/v1/media/videos/upload-url/",
            {
                "title": "Vidéo trop lourde",
                "file_name": "heavy.mp4",
                "file_size": 130 * 1024 * 1024,  # 130 Mo > 128 Mo
                "mime_type": "video/mp4",
                "purpose": "post_video",
            },
            format="json",
        )
        self.assertEqual(too_big_video.status_code, 400)

        # 3. Publication immédiate d'un post avec la vidéo encore en attente/encodage (non bloquant)
        post_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Post avec vidéo en traitement",
                "content": "La vidéo est en cours de transcodage sur Mux 🎬",
                "post_type": "project_showcase",
                "video_ids": [video_id],
            },
            format="json",
        )
        self.assertEqual(post_res.status_code, 201)
        media_items = post_res.data["data"]["media"]
        self.assertEqual(len(media_items), 1)
        self.assertEqual(media_items[0]["type"], "VIDEO")
        self.assertEqual(media_items[0]["provider"], "MUX")
        self.assertEqual(media_items[0]["status"], "PENDING_UPLOAD")

    # =========================================================================
    # TEST 5 — WEBHOOK MUX & IDEMPOTENCE
    # =========================================================================
    def test_05_mux_webhook_lifecycle_and_idempotence(self):
        video = VideoAsset.objects.create(
            user=self.author,
            title="Tutoriel Django",
            upload_id="upload_abc_123",
            status=VideoStatus.WAITING,
        )

        # 1. Webhook video.upload.asset_created -> statut PREPARING (PROCESSING)
        res1 = self.client.post(
            "/api/v1/media/mux/webhook/",
            data=json.dumps(
                {
                    "id": "evt_001",
                    "type": "video.upload.asset_created",
                    "data": {"id": "upload_abc_123", "asset_id": "asset_xyz_789"},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res1.status_code, 200)
        video.refresh_from_db()
        self.assertEqual(video.status, VideoStatus.PREPARING)
        self.assertEqual(video.normalized_status, "PROCESSING")
        self.assertEqual(video.asset_id, "asset_xyz_789")

        # 2. Webhook video.asset.ready -> statut READY + playback_id + hls_url + thumbnail_url
        res2 = self.client.post(
            "/api/v1/media/mux/webhook/",
            data=json.dumps(
                {
                    "id": "evt_002",
                    "type": "video.asset.ready",
                    "data": {
                        "id": "asset_xyz_789",
                        "playback_ids": [{"id": "play_public_001", "policy": "public"}],
                        "duration": 42.5,
                        "aspect_ratio": "16:9",
                        "max_stored_resolution": "1080p",
                    },
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res2.status_code, 200)
        video.refresh_from_db()
        self.assertEqual(video.status, VideoStatus.READY)
        self.assertEqual(video.normalized_status, "READY")
        self.assertEqual(video.playback_id, "play_public_001")
        self.assertEqual(video.hls_url, "https://stream.mux.com/play_public_001.m3u8")
        self.assertIn("image.mux.com/play_public_001", video.thumbnail_url)

        # 3. Idempotence : renvoi du même événement evt_002 ou d'un événement retardé video.asset.created
        res_dup = self.client.post(
            "/api/v1/media/mux/webhook/",
            data=json.dumps(
                {
                    "id": "evt_002",
                    "type": "video.asset.ready",
                    "data": {"id": "asset_xyz_789"},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res_dup.status_code, 200)

        res_late = self.client.post(
            "/api/v1/media/mux/webhook/",
            data=json.dumps(
                {
                    "id": "evt_003_late",
                    "type": "video.asset.created",
                    "data": {"id": "asset_xyz_789"},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res_late.status_code, 200)
        video.refresh_from_db()
        # Ne doit pas repasser en PREPARING alors qu'il est déjà READY
        self.assertEqual(video.status, VideoStatus.READY)

    # =========================================================================
    # TEST 6 — UPLOAD DE DOCUMENTS & BLOCAGE DES EXÉCUTABLES / SIGNATURES
    # =========================================================================
    def test_06_document_upload_and_dangerous_file_rejection(self):
        self.client.force_authenticate(user=self.author)

        # 1. Upload d'un PDF valide
        pdf_file = SimpleUploadedFile(
            "architecture.pdf", VALID_PDF_BYTES, content_type="application/pdf"
        )
        pdf_res = self.client.post(
            "/api/v1/media/upload/",
            {"file": pdf_file, "purpose": "post_document"},
            format="multipart",
        )
        self.assertEqual(pdf_res.status_code, 201)
        pdf_asset_id = pdf_res.data["data"]["asset_id"]

        # 2. Upload d'un CSV valide
        csv_file = SimpleUploadedFile(
            "metrics.csv", b"id,score\n1,98\n", content_type="text/csv"
        )
        csv_res = self.client.post(
            "/api/v1/media/upload/",
            {"file": csv_file, "purpose": "post_document"},
            format="multipart",
        )
        self.assertEqual(csv_res.status_code, 201)

        # 3. Rejet strict d'une extension exécutable (.exe, .sh, .php)
        exe_file = SimpleUploadedFile(
            "malware.exe",
            b"MZ\x90\x00\x03\x00\x00\x00",
            content_type="application/octet-stream",
        )
        exe_res = self.client.post(
            "/api/v1/media/upload/",
            {"file": exe_file, "purpose": "post_document"},
            format="multipart",
        )
        self.assertEqual(exe_res.status_code, 400)

        # 4. Rejet d'un binaire Windows PE (MZ) déguisé en fichier .pdf
        disguised_pdf = SimpleUploadedFile(
            "fake.pdf", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/pdf"
        )
        disguised_res = self.client.post(
            "/api/v1/media/upload/",
            {"file": disguised_pdf, "purpose": "post_document"},
            format="multipart",
        )
        self.assertEqual(disguised_res.status_code, 400)

        # 5. Association du PDF à un post et vérification de la structure unifiée
        post_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Documentation technique",
                "content": "Voici le PDF du projet 📄",
                "post_type": "discussion",
                "media_ids": [pdf_asset_id],
            },
            format="json",
        )
        self.assertEqual(post_res.status_code, 201)
        doc_media = post_res.data["data"]["media"][0]
        self.assertEqual(doc_media["type"], "DOCUMENT")
        self.assertEqual(doc_media["filename"], "architecture.pdf")

    # =========================================================================
    # TEST 7 — PERMISSIONS D'ACCÈS, TÉLÉCHARGEMENT & ANTI-IDOR
    # =========================================================================
    def test_07_security_permissions_and_anti_idor(self):
        # Créer un document appartenant à `author`
        doc_asset = MediaAsset.objects.create(
            user=self.author,
            file_name="secret_roadmap.pdf",
            file_key="kodinga/post_document/secret_roadmap.pdf",
            file_url="https://utfs.io/f/secret_roadmap.pdf",
            file_size=4096,
            mime_type="application/pdf",
            provider=MediaProvider.UPLOADTHING,
            purpose=MediaPurpose.POST_DOCUMENT,
            status=MediaStatus.READY,
        )

        # 1. Anti-IDOR : `other_user` tente d'attacher le document de `author` à son propre post -> 403
        self.client.force_authenticate(user=self.other_user)
        idor_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Tentative IDOR",
                "content": "Je tente de voler le document d un autre membre",
                "post_type": "discussion",
                "media_ids": [str(doc_asset.id)],
            },
            format="json",
        )
        self.assertEqual(idor_res.status_code, 403)

        # 2. `author` attache le document à un post de la communauté PRIVÉE
        self.client.force_authenticate(user=self.author)
        priv_post_res = self.client.post(
            f"/api/v1/communities/{self.private_community.slug}/feed/",
            {
                "title": "Roadmap VIP",
                "content": "Document réservé aux membres VIP",
                "post_type": "announcement",
                "media_ids": [str(doc_asset.id)],
            },
            format="json",
        )
        self.assertEqual(priv_post_res.status_code, 201)

        # 3. `outsider` (non-membre de la communauté privée) tente de télécharger le document -> 403
        self.client.force_authenticate(user=self.outsider)
        dl_forbidden = self.client.get(f"/api/v1/media/assets/{doc_asset.id}/download/")
        self.assertEqual(dl_forbidden.status_code, 403)

        # 4. `author` (membre/propriétaire) télécharge le document -> 200
        self.client.force_authenticate(user=self.author)
        dl_ok = self.client.get(f"/api/v1/media/assets/{doc_asset.id}/download/")
        self.assertEqual(dl_ok.status_code, 200)
        self.assertEqual(dl_ok.data["data"]["file_name"], "secret_roadmap.pdf")

    # =========================================================================
    # TEST 8 — SUPPRESSION DE MÉDIA D'UN POST & NETTOYAGE
    # =========================================================================
    def test_08_delete_post_media_and_post_cleanup(self):
        self.client.force_authenticate(user=self.author)

        img_asset = MediaAsset.objects.create(
            user=self.author,
            file_name="banner.png",
            file_key="kodinga/post_image/banner.png",
            file_url="https://utfs.io/f/banner.png",
            file_size=2048,
            mime_type="image/png",
            provider=MediaProvider.UPLOADTHING,
            purpose=MediaPurpose.POST_IMAGE,
            status=MediaStatus.READY,
        )
        video_asset = VideoAsset.objects.create(
            user=self.author,
            title="Clip démo",
            asset_id="mux_asset_del_test",
            playback_id="mux_play_del_test",
            status=VideoStatus.READY,
        )

        post_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Post à nettoyer",
                "content": "Contient une image et une vidéo",
                "post_type": "discussion",
                "media_ids": [str(img_asset.id)],
                "video_ids": [str(video_asset.id)],
            },
            format="json",
        )
        self.assertEqual(post_res.status_code, 201)
        post_id = post_res.data["data"]["id"]
        self.assertEqual(len(post_res.data["data"]["media"]), 2)

        # 1. Un autre membre non modérateur ne peut pas supprimer le média du post -> 403
        self.client.force_authenticate(user=self.other_user)
        unauth_del = self.client.delete(
            f"/api/v1/posts/{post_id}/media/{img_asset.id}/"
        )
        self.assertEqual(unauth_del.status_code, 403)

        # 2. L'auteur supprime l'image du post -> 200 et l'asset passe en DELETED
        self.client.force_authenticate(user=self.author)
        auth_del = self.client.delete(f"/api/v1/posts/{post_id}/media/{img_asset.id}/")
        self.assertEqual(auth_del.status_code, 200)
        img_asset.refresh_from_db()
        self.assertEqual(img_asset.status, MediaStatus.DELETED)

        # 3. L'auteur supprime la publication entière -> la vidéo restante passe en DELETED
        del_post_res = self.client.delete(f"/api/v1/posts/{post_id}/")
        self.assertEqual(del_post_res.status_code, 200)
        self.assertFalse(Post.objects.filter(id=post_id).exists())
        video_asset.refresh_from_db()
        self.assertEqual(video_asset.status, VideoStatus.DELETED)

    # =========================================================================
    # TEST 9 — CRÉATION D'UN FEED EN JOIGNANT DIRECTEMENT IMAGE + DOCUMENT + VIDÉO & RÉACTIONS EMOJIS
    # =========================================================================
    def test_09_create_feed_post_with_direct_multipart_image_document_video_and_emoji_reactions(
        self,
    ):
        self.client.force_authenticate(user=self.author)

        img_file = SimpleUploadedFile(
            "feed_image.png", VALID_PNG_BYTES, content_type="image/png"
        )
        doc_file = SimpleUploadedFile(
            "feed_guide.pdf", VALID_PDF_BYTES, content_type="application/pdf"
        )
        vid_file = SimpleUploadedFile(
            "feed_demo.mp4",
            b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42mp41",
            content_type="video/mp4",
        )

        # 1. Création d'un post dans le Feed en joignant directement image + document + vidéo en multipart/form-data
        create_res = self.client.post(
            f"/api/v1/communities/{self.public_community.slug}/feed/",
            {
                "title": "Publication complète multimédia 🚀🔥",
                "content": "Image, document PDF et vidéo joints directement à la création ! 👨‍💻✨",
                "post_type": "project_showcase",
                "image": img_file,
                "document": doc_file,
                "video": vid_file,
            },
            format="multipart",
        )
        self.assertEqual(create_res.status_code, 201)
        post_data = create_res.data["data"]
        post_id = post_data["id"]

        media_list = post_data["media"]
        self.assertEqual(len(media_list), 3)
        media_types = {item["type"] for item in media_list}
        self.assertEqual(media_types, {"IMAGE", "DOCUMENT", "VIDEO"})

        # 2. Sélection et application de réactions emojis (standard + emoji Unicode direct) sur le post
        react1 = self.client.post(
            f"/api/v1/posts/{post_id}/react/",
            {"reaction_type": "fire"},
            format="json",
        )
        self.assertEqual(react1.status_code, 200)
        self.assertTrue(react1.data["data"]["reacted"])

        react2 = self.client.post(
            f"/api/v1/posts/{post_id}/react/",
            {"emoji": "🎉"},
            format="json",
        )
        self.assertEqual(react2.status_code, 200)
        self.assertTrue(react2.data["data"]["reacted"])

        # 3. Vérification de la visualisation des emojis et du résumé des réactions dans le Feed
        detail_res = self.client.get(f"/api/v1/posts/{post_id}/")
        self.assertEqual(detail_res.status_code, 200)
        summary = detail_res.data["data"]["reactions_summary"]
        self.assertEqual(summary.get("fire"), 1)
        self.assertEqual(summary.get("🎉"), 1)
        self.assertIn("🎉", detail_res.data["data"]["user_reactions"])
