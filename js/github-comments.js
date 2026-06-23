/**
 * GitHub Issues-based Comment System
 * Uses GitHub Issues as a backend for model comments and ratings
 */

class GitHubComments {
    constructor() {
        // These will be configured when deploying
        this.owner = '';
        this.repo = '';
        this.issueLabels = {};
        this.accessToken = null;
        this.currentUser = null;
        
        this.init();
    }
    
    init() {
        // Try to get repo info from URL
        this.detectRepoInfo();
        
        // Check for stored access token
        this.accessToken = localStorage.getItem('github_token');
        if (this.accessToken) {
            this.fetchCurrentUser();
        }
    }
    
    detectRepoInfo() {
        // For GitHub Pages, we can detect the repo from the URL
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        if (hostname.endsWith('.github.io')) {
            const parts = pathname.split('/').filter(Boolean);
            if (parts.length >= 1) {
                this.owner = hostname.replace('.github.io', '');
                this.repo = parts[0];
            }
        }
        
        // Allow manual override
        const savedConfig = localStorage.getItem('github_comments_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.owner = config.owner || this.owner;
                this.repo = config.repo || this.repo;
            } catch (e) {}
        }
    }
    
    async fetchCurrentUser() {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.updateUIForLoggedInUser();
            } else {
                this.logout();
            }
        } catch (e) {
            console.error('Error fetching user:', e);
        }
    }
    
    updateUIForLoggedInUser() {
        const container = document.getElementById('comment-form-container');
        if (!container || !this.currentUser) return;
        
        const lang = window.i18n?.currentLang || 'zh';
        const placeholder = lang === 'zh' ? '分享你对这个模型的使用体验...' : 'Share your experience with this model...';
        
        container.innerHTML = `
            <div class="comment-form">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <img src="${this.currentUser.avatar_url}" alt="${this.currentUser.login}" 
                         style="width: 32px; height: 32px; border-radius: 50%;">
                    <span style="font-weight: 600;">${this.currentUser.login}</span>
                    <button onclick="githubComments.logout()" class="btn-secondary" style="margin-left: auto; padding: 0.5rem 1rem; font-size: 0.85rem;">
                        ${lang === 'zh' ? '退出' : 'Logout'}
                    </button>
                </div>
                <div class="rating-input">
                    <span style="margin-right: 0.5rem;">${window.i18n?.t('rating_label') || 'Rating'}:</span>
                    ${[1,2,3,4,5].map(i => `
                        <span class="rating-star" data-rating="${i}" onclick="githubComments.setRating(${i})">★</span>
                    `).join('')}
                </div>
                <textarea id="comment-text" placeholder="${placeholder}"></textarea>
                <button onclick="githubComments.submitComment()" class="btn-primary">
                    ${window.i18n?.t('submit_comment') || 'Submit Comment'}
                </button>
            </div>
        `;
    }
    
    login() {
        // For simplicity, we'll use a personal access token
        // In production, you'd use OAuth
        const lang = window.i18n?.currentLang || 'zh';
        const promptMsg = lang === 'zh' 
            ? '请输入GitHub Personal Access Token (需要repo权限):' 
            : 'Enter GitHub Personal Access Token (repo scope required):';
        
        const token = prompt(promptMsg);
        if (token) {
            this.accessToken = token;
            localStorage.setItem('github_token', token);
            this.fetchCurrentUser();
        }
    }
    
    logout() {
        this.accessToken = null;
        this.currentUser = null;
        localStorage.removeItem('github_token');
        
        const container = document.getElementById('comment-form-container');
        if (container) {
            const lang = window.i18n?.currentLang || 'zh';
            container.innerHTML = `
                <p class="login-hint">${window.i18n?.t('login_hint') || 'Login with GitHub to comment'}</p>
                <button onclick="githubComments.login()" class="btn-primary">
                    ${window.i18n?.t('login_github') || 'Login with GitHub'}
                </button>
            `;
        }
    }
    
    setRating(rating) {
        this.currentRating = rating;
        document.querySelectorAll('.rating-star').forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            star.classList.toggle('active', starRating <= rating);
        });
    }
    
    async getOrCreateIssue(modelId) {
        // Use a single issue per model, labeled with the model ID
        const label = `model:${modelId}`;
        
        try {
            // Search for existing issue
            const searchResponse = await fetch(
                `https://api.github.com/search/issues?q=repo:${this.owner}/${this.repo}+label:${encodeURIComponent(label)}+is:issue`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                if (searchData.items && searchData.items.length > 0) {
                    return searchData.items[0].number;
                }
            }
        } catch (e) {}
        
        // Create new issue if not found (requires auth)
        if (!this.accessToken) return null;
        
        try {
            // First ensure label exists
            await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/labels`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: label,
                    color: '4361ee',
                    description: `Comments for model: ${modelId}`
                })
            }).catch(() => {}); // Ignore if label already exists
            
            // Create issue
            const response = await fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: `Model Comments: ${modelId}`,
                    labels: [label, 'model-comments'],
                    body: `This issue tracks user comments and ratings for the model: ${modelId}`
                })
            });
            
            if (response.ok) {
                const issue = await response.json();
                return issue.number;
            }
        } catch (e) {
            console.error('Error creating issue:', e);
        }
        
        return null;
    }
    
    async loadComments(modelId) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        const lang = window.i18n?.currentLang || 'zh';
        commentsList.innerHTML = `<p style="color: var(--text-muted); text-align: center;">${lang === 'zh' ? '加载中...' : 'Loading...'}</p>`;
        
        if (!this.owner || !this.repo) {
            commentsList.innerHTML = `
                <p style="color: var(--text-muted); text-align: center;">
                    ${lang === 'zh' ? '评论系统未配置' : 'Comments not configured'}
                </p>
            `;
            return;
        }
        
        try {
            const issueNumber = await this.getOrCreateIssue(modelId);
            if (!issueNumber) {
                commentsList.innerHTML = `
                    <p style="color: var(--text-muted); text-align: center;">
                        ${window.i18n?.t('no_comments') || 'No comments yet'}
                    </p>
                `;
                return;
            }
            
            // Fetch comments
            const response = await fetch(
                `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                const comments = await response.json();
                this.renderComments(comments);
            }
        } catch (e) {
            console.error('Error loading comments:', e);
            commentsList.innerHTML = `
                <p style="color: var(--danger); text-align: center;">
                    ${window.i18n?.t('comment_error') || 'Error loading comments'}
                </p>
            `;
        }
    }
    
    renderComments(comments) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        if (comments.length === 0) {
            commentsList.innerHTML = `
                <p style="color: var(--text-muted); text-align: center; padding: 2rem;">
                    ${window.i18n?.t('no_comments') || 'No comments yet. Be the first!'}
                </p>
            `;
            return;
        }
        
        const lang = window.i18n?.currentLang || 'zh';
        
        commentsList.innerHTML = comments.map(comment => {
            const user = comment.user;
            const date = new Date(comment.created_at);
            const dateStr = date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
            
            // Try to extract rating from comment body
            const ratingMatch = comment.body.match(/⭐\s*(\d)/);
            const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
            const ratingStars = rating ? '⭐'.repeat(rating) : '';
            
            // Remove rating from display text
            const displayBody = comment.body.replace(/\[Rating:\s*\d\/5\]\s*/, '').trim();
            
            return `
                <div class="comment fade-in">
                    <div class="comment-header">
                        <img src="${user.avatar_url}" alt="${user.login}" class="comment-avatar">
                        <span class="comment-user">${user.login}</span>
                        <span class="comment-time">${dateStr}</span>
                        ${ratingStars ? `<span class="comment-rating">${ratingStars}</span>` : ''}
                    </div>
                    <div class="comment-body">${this.formatComment(displayBody)}</div>
                </div>
            `;
        }).join('');
    }
    
    formatComment(text) {
        // Simple markdown-like formatting
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }
    
    async submitComment() {
        if (!this.accessToken) {
            this.login();
            return;
        }
        
        const textarea = document.getElementById('comment-text');
        const text = textarea?.value?.trim();
        
        if (!text) return;
        
        const modelModal = document.getElementById('model-modal');
        const modelId = modelModal?.dataset?.currentModel;
        
        if (!modelId) return;
        
        const rating = this.currentRating || 0;
        const ratingText = rating > 0 ? `[Rating: ${rating}/5] ${'⭐'.repeat(rating)}\n\n` : '';
        
        try {
            const issueNumber = await this.getOrCreateIssue(modelId);
            if (!issueNumber) {
                alert(window.i18n?.t('comment_error') || 'Error submitting comment');
                return;
            }
            
            const response = await fetch(
                `https://api.github.com/repos/${this.owner}/${this.repo}/issues/${issueNumber}/comments`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.accessToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        body: ratingText + text
                    })
                }
            );
            
            if (response.ok) {
                textarea.value = '';
                this.currentRating = 0;
                this.loadComments(modelId);
                
                // Show success message
                const lang = window.i18n?.currentLang || 'zh';
                const msg = lang === 'zh' ? '评论发表成功！' : 'Comment submitted!';
                this.showToast(msg);
            }
        } catch (e) {
            console.error('Error submitting comment:', e);
        }
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--success);
            color: white;
            padding: 1rem 2rem;
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-md);
            z-index: 10000;
            animation: fadeIn 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
let githubComments;
document.addEventListener('DOMContentLoaded', () => {
    githubComments = new GitHubComments();
    window.githubComments = githubComments;
});

// Make login/logout global
window.githubComments_login = () => githubComments?.login();
window.githubComments_logout = () => githubComments?.logout();
