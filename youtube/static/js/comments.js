function onClickReplies(e) {
  var details = e.target.parentElement;
  console.log("loading replies ..");
  doXhr(details.getAttribute("src") + "&slim=1", (html) => {
    var div = details.querySelector(".comment_page");
    div.innerHTML = html;
  });
  details.removeEventListener('click', onClickReplies);
}

function onClickMoreComments(e) {
  e.preventDefault();
  var btn = e.target;
  var moreUrl = btn.getAttribute('data-more-url');
  if (!moreUrl) return;
  
  console.log("Loading more comments...");
  btn.textContent = "Loading...";
  
  doXhr(moreUrl + "&slim=1", (html) => {
    var commentsContainer = btn.previousElementSibling;
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    var newComments = tempDiv.querySelectorAll('.comment');
    newComments.forEach(function(comment) {
      commentsContainer.appendChild(comment);
    });
    // Remove button if no more comments, or update URL
    var nextMatch = html.match(/data-more-url="([^"]+)"/);
    if (nextMatch) {
      btn.setAttribute('data-more-url', nextMatch[1]);
      btn.textContent = "More comments";
    } else {
      btn.remove();
    }
  });
}

function onClickSortComments(e) {
  e.preventDefault();
  var btn = e.target;
  var sortUrl = btn.getAttribute('data-sort-url');
  if (!sortUrl) return;
  
  console.log("Loading sorted comments...");
  
  // Add loading state to all sort buttons
  document.querySelectorAll('.sort-button').forEach(function(b) {
    b.classList.add('loading');
  });
  
  doXhr(sortUrl + "&slim=1", (html) => {
    // Find comments section in current page and replace it
    var tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get the comments container from the response
    var newCommentsContainer = tempDiv.querySelector('.comments');
    var newMoreBtn = tempDiv.querySelector('.more-comments');
    var newSortButtons = tempDiv.querySelectorAll('.sort-button');
    
    var currentCommentsContainer = document.getElementById('comments-container');
    if (currentCommentsContainer && newCommentsContainer) {
      currentCommentsContainer.innerHTML = newCommentsContainer.innerHTML;
    }
    
    // Update more comments button
    var currentMoreBtn = document.querySelector('.more-comments');
    if (currentMoreBtn && newMoreBtn) {
      currentMoreBtn.setAttribute('data-more-url', newMoreBtn.getAttribute('data-more-url') || '');
      currentMoreBtn.style.display = newMoreBtn.style.display || 'inline-block';
    } else if (currentMoreBtn && !newMoreBtn) {
      currentMoreBtn.remove();
    }
    
    // Update sort button active state
    document.querySelectorAll('.sort-button').forEach(function(b) {
      b.classList.remove('loading');
    });
    newSortButtons.forEach(function(b) {
      var currentBtn = document.querySelector('.sort-button[data-sort-url*="' + b.getAttribute('data-sort-url').split('?')[1].substring(0, 20) + '"]');
      if (currentBtn && b.classList.contains('selected')) {
        currentBtn.classList.add('selected');
      }
    });
  });
}

window.addEventListener('DOMContentLoaded', function() {
    QA("details.replies").forEach(details => {
      details.addEventListener('click', onClickReplies);
      details.addEventListener('auxclick', (e) => {
        if (e.target.parentElement !== details) return;
        if (e.button == 1) window.open(details.getAttribute("src"));
      });
    });
    
    // Handle "More comments" click
    QA(".more-comments").forEach(btn => {
      btn.addEventListener('click', onClickMoreComments);
    });
    
    // Handle sort buttons click
    QA(".sort-button").forEach(btn => {
      btn.addEventListener('click', onClickSortComments);
    });
});